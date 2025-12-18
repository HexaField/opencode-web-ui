import { expect, test } from '@playwright/test'
import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TEST_DIR_PREFIX = 'opencode-e2e-test-theme-'

test.describe('Theme Switcher', () => {
  let testDir: string

  test.beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), TEST_DIR_PREFIX))
    await fs.writeFile(path.join(testDir, 'package.json'), '{}')
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@example.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })
    await execAsync('git add .', { cwd: testDir })
    await execAsync('git commit -m "Initial commit"', { cwd: testDir })
  })

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup test dir:', e)
    }
  })

  test('should switch themes correctly', async ({ page }) => {
    await page.goto('/')
    
    // Enter path and go
    await page.fill('input[placeholder="Enter path..."]', testDir)
    await page.click('button:has-text("Go")')
    await page.click('button:has-text("Select this folder")')

    // Open settings
    await page.click('button[title="Settings"]')
    await expect(page.locator('text=Appearance')).toBeVisible()

    // Switch to Dark
    await page.click('button:has-text("Dark")')
    
    // Check if html has dark class
    await expect(page.locator('html')).toHaveClass(/dark/)
    
    // Check background color (should be dark)
    // We check the main workspace div which has dark:bg-[#0d1117]
    const workspace = page.locator('.flex.h-screen.w-screen')
    await expect(workspace).toHaveCSS('background-color', 'rgb(13, 17, 23)') // #0d1117

    // Switch to Light
    await page.click('button:has-text("Light")')
    
    // Check if html does NOT have dark class
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    
    // Check background color (should be white)
    await expect(workspace).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })
})
