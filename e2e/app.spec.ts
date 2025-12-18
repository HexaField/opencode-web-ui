import { expect, test } from '@playwright/test'
import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TEST_DIR_PREFIX = 'opencode-e2e-test-'

test.describe('OpenCode Web UI E2E', () => {
  let testDir: string

  test.beforeAll(async () => {
    // Create a temporary directory for the test project
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), TEST_DIR_PREFIX))
    // Create some dummy files
    await fs.writeFile(path.join(testDir, 'hello.txt'), 'Hello E2E')
    await fs.writeFile(path.join(testDir, 'package.json'), '{}')

    // Initialize git repo
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@example.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })
    await execAsync('git add .', { cwd: testDir })
    await execAsync('git commit -m "Initial commit"', { cwd: testDir })
  })

  test.afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup test dir:', e)
    }
  })

  test('full user flow', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/')

    // 2. Enter path and go
    await page.fill('input[placeholder="Enter path..."]', testDir)
    await page.click('button:has-text("Go")')

    // 3. Select folder
    await page.click('button:has-text("Select this folder")')

    // 4. Create session
    await page.click('button[title="New Session"]') // Create session button

    // 5. Wait for session to appear in list and be selected
    await expect(page.locator('text=New Session')).toBeVisible()

    // 6. Send message
    await page.fill('textarea[placeholder="Type a message..."]', 'List files')
    await page.click('button[title="Send"]')

    // 7. Verify response (Assistant should reply)
    await expect(page.getByTestId('message-assistant').last()).toBeVisible({ timeout: 30000 })

    // 8. Check Diff View
    await page.click('button:has-text("Changes")')
    await expect(page.locator('text=No changes detected')).toBeVisible()

    // 9. Modify a file to see changes
    await fs.writeFile(path.join(testDir, 'hello.txt'), 'Hello Modified')

    // Switch tabs to refresh
    await page.click('button:has-text("Chat")')
    await page.click('button:has-text("Changes")')

    await expect(page.locator('text=hello.txt')).toBeVisible()
    await expect(page.locator('.text-yellow-600', { hasText: 'M' })).toBeVisible() // Modified status
  })
})
