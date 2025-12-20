import { expect, test } from '@playwright/test'

test.describe('Tool UI', () => {
  test('renders tool calls correctly', async ({ page }) => {
    // Mock the session response
    await page.route('**/api/sessions/test-session*', async (route) => {
      const json = {
        id: 'test-session',
        history: [
          {
            info: { role: 'assistant', id: 'msg1', sessionID: 's1', time: { created: Date.now() } },
            parts: [
              {
                type: 'tool',
                tool: 'list',
                state: {
                  status: 'completed',
                  input: { path: '/test/path' },
                  output: '/test/path\n'
                }
              },
              {
                type: 'tool',
                tool: 'write',
                state: {
                  status: 'completed',
                  input: { filePath: '/test/file.txt', content: 'hello world' }
                }
              }
            ]
          }
        ]
      }
      await route.fulfill({ json })
    })

    // Navigate to a session page
    await page.goto('/?folder=/tmp&session=test-session')

    // Check if tool calls are rendered
    await expect(page.getByText('Tool: list')).toBeVisible()
    await page.getByText('Tool: list').click()
    await expect(page.getByText('/test/path').first()).toBeVisible()

    await expect(page.getByText('Tool: write')).toBeVisible()
    await page.getByText('Tool: write').click()
    await expect(page.getByText('/test/file.txt')).toBeVisible()
    await expect(page.getByText('hello world')).toBeVisible()
  })
})
