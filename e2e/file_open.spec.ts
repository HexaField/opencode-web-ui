import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

test.describe('Tool Call File Opening', () => {
  let testDir: string

  test.beforeEach(async ({ page }) => {
    // Create a temporary directory for the test project
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-e2e-file-open-'))

    // Create a dummy file to read
    const testFile = path.join(testDir, 'test-file.txt')
    fs.writeFileSync(testFile, 'Hello World')

    // Go to workspace with the temp folder
    await page.goto(`/?folder=${testDir}`)
  })

  test.afterEach(async () => {
    // Clean up
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup test dir:', e)
    }
  })

  test('clicking file name in tool call should open file editor', async ({ page }) => {
    // Mock the session response with a tool call that reads a file
    await page.route('**/api/sessions/test-session-file*', async (route) => {
      const json = {
        id: 'test-session-file',
        history: [
          {
            info: { role: 'assistant', id: 'msg1', sessionID: 's1', time: { created: Date.now() } },
            parts: [
              {
                type: 'tool',
                tool: 'read',
                state: {
                  status: 'completed',
                  input: { filePath: path.join(testDir, 'test-file.txt') },
                  output: 'Hello World'
                }
              }
            ]
          }
        ]
      }
      await route.fulfill({ json })
    })

    // Navigate to the session directly
    await page.goto(`/?folder=${testDir}&session=test-session-file`)

    // Wait for the tool call to appear
    // The tool call component shows "Tool: read" or similar depending on implementation
    // Let's check what ToolCall.tsx renders
    // Assuming it renders the tool name and input

    // Wait for the chat interface to load
    await page.waitForSelector('textarea[placeholder="Type a message..."]')

    // Check for the file path in the tool call
    // The UI might show the full path or relative path
    // We'll look for the filename
    await expect(page.locator(`button:has-text("test-file.txt")`)).toBeVisible()

    // 3. Click the file name
    const fileLink = page.locator(`button:has-text("test-file.txt")`)
    await fileLink.click()

    // 4. Verify we opened the file
    await expect(page.locator('.monaco-editor')).toBeVisible()
  })
})
