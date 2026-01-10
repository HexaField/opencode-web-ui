import { expect, test } from '@playwright/test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

const TEST_DIR_PREFIX = 'opencode-terminal-test-'

test.describe('Terminal E2E', () => {
  let testDir: string

  test.beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), TEST_DIR_PREFIX))
    // Create a real directory that exists so the backend validation passes
    testDir = await fs.realpath(testDir)
  })

  test.afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {}
  })

  test('can run commands in terminal', async ({ page }) => {
    // Navigate directly with folder param to skip selection screen
    await page.goto(`/?folder=${encodeURIComponent(testDir)}`)

    // Switch to Terminal tab
    const terminalTabBtn = page.locator('button', { hasText: 'Terminal' })
    await terminalTabBtn.click()

    // Check if button became active (has white background in light mode or dark background in dark mode)
    // The class string in DesktopWorkspace is: bg-white dark:bg-[#161b22] shadow-sm font-medium
    // We match 'bg-white' or 'shadow-sm'
    await expect(terminalTabBtn).toHaveClass(/shadow-sm/)

    // Wait for the terminal screen to be visible
    const terminalScreen = page.locator('.xterm-screen')
    await expect(terminalScreen).toBeVisible({ timeout: 5000 })

    // Focus and Type
    // xterm captures keys on the textarea helper or the element itself when focused
    // await page.click('.xterm-screen') // Rely on auto-focus

    // Use pwd which should output the current working directory path
    await page.keyboard.type('pwd')
    await page.keyboard.press('Enter')

    // Wait for output
    // The workspace folder is passed to the terminal, so PWD should return the testDir path.
    // The testDir usually contains 'opencode-terminal-test-'
    // We check that the output contains the specific unique part of the test directory name
    await expect(page.locator('.xterm-rows')).toContainText(TEST_DIR_PREFIX)
  })
})
