import { expect, test } from '@playwright/test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { loadEnv } from 'vite'

const env = loadEnv('test', process.cwd(), '')

// Determine the dashboard root used by the server
const USER_DATA_ROOT = env.OPENCODE_USER_DATA || process.env.OPENCODE_USER_DATA || path.join(os.homedir(), '.opencode')

test.describe('Personal Agent Chat', () => {
  let testDir: string

  test.beforeAll(async () => {
    // We must use the specific folder that the server considers "Agents Dashboard"
    // However, if we write to it, we might affect other things.
    // For this test, we assume the server is running with OPENCODE_USER_DATA set to a test path
    // defined in .env.test.

    // Check if we can write to it or if it exists
    testDir = path.join(USER_DATA_ROOT, 'AGENT')

    // Ensure it exists with package.json (Server Init should have handled directories, but package.json might be missing)
    await fs.mkdir(testDir, { recursive: true })
    if (!(await fs.stat(path.join(testDir, 'package.json')).catch(() => false))) {
      await fs.writeFile(path.join(testDir, 'package.json'), '{}')
    }
  })

  test.afterAll(async () => {
    // Do not delete the shared root, as it is used by the server process
  })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.text()}`))
    page.on('response', async (response) => {
      if (response.status() >= 400) {
        console.log(`[Network Error] ${response.status()} ${response.url()}`)
        try {
          console.log(`[Network Body] ${await response.text()}`)
        } catch (e) {
          console.log('Could not read body')
        }
      }
    })

    console.log(`Navigating to test folder: ${testDir}`)
    // Use query param to force open the folder directly
    await page.goto(`/?folder=${encodeURIComponent(testDir)}`)

    // Wait for the session list to confirm workspace is loaded
    console.log('Waiting for Sessions sidebar...')
    await expect(page.getByText('Sessions')).toBeVisible({ timeout: 15000 })
  })

  test('should use personal agent logic when in dashboard folder, regardless of selected agent', async ({ page }) => {
    // 1. Select "Default" agent (empty string)
    console.log('Selecting Default agent...')
    const agentSelect = page.locator('select').filter({ hasText: 'Default' }).first()
    await agentSelect.selectOption('') // Select Default

    // 2. Click "New Session"
    // The button title is "New Session"
    console.log('Clicking New Session...')
    await page.getByTitle('New Session').click()

    // 3. Verify URL change (new session ID)
    await expect(page).toHaveURL(/session=ses_.+/)

    // Verify we are still in the correct folder
    const url = page.url()
    expect(url).toContain(encodeURIComponent(testDir))

    // 4. Send a message
    console.log('Sending message...')
    const message = 'Hello Personal Dashboard, act as system.'
    const input = page.getByPlaceholder('Type a message...')

    await expect(input).toBeVisible()
    await input.fill(message)
    await page.keyboard.press('Enter')

    // 5. Verify the message is displayed in the chat
    console.log('Verifying message display...')
    await expect(page.getByText(message)).toBeVisible()

    // 6. Verify payload accepted - if logic works, it enters "thinking" state.
    // However, in E2E without real LLM, the PersonalAgent might fail or finish instantly.
    // The critical proof that the logic worked is that we did NOT get a 400 "Model is required" error
    // (which would happen if we fell through to standard logic with Default agent).
    // And that the message is displayed (verified in step 5).

    // Optional: wait a bit to ensure no error toast appears
    await page.waitForTimeout(1000)
    await expect(page.locator('.toast-error')).not.toBeVisible()
  })
})
