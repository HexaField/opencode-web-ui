import { expect, test } from '@playwright/test'
import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

test.describe('Message Editing', () => {
  let testDir: string

  test.beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-edit-test-'))
    testDir = await fs.realpath(testDir)
    await fs.writeFile(path.join(testDir, 'package.json'), '{}')
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "test@example.com"', { cwd: testDir })
    await execAsync('git config user.name "Test User"', { cwd: testDir })
  })

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error(e)
    }
  })

  test('edits the first message and creates a new session', async ({ page }) => {
    // Mock Status
    await page.route('**/api/sessions/*/status*', async (route) => {
      await route.fulfill({ json: { status: 'idle' } })
    })

    // Mock Session List (for sidebar)
    await page.route('**/api/sessions?folder=*', async (route) => {
      if (route.request().method() === 'GET') {
        // Return empty list initially or simple list
        await route.fulfill({ json: [] })
      } else {
        // POST create session
        await route.fulfill({ json: { id: 'session-new', directory: testDir } })
      }
    })

    // Mock Session Get (Initial)
    await page.route('**/api/sessions/session-123*', async (route) => {
      await route.fulfill({
        json: {
          id: 'session-123',
          history: [
            {
              info: { id: 'msg-1', role: 'user', time: { created: 1000 } },
              parts: [{ type: 'text', text: 'First Message' }]
            },
            {
              info: { id: 'msg-2', role: 'user', time: { created: 2000 } },
              parts: [{ type: 'text', text: 'Response' }]
            }
          ]
        }
      })
    })

    // Mock Session Get (New Session)
    await page.route('**/api/sessions/session-new*', async (route) => {
      await route.fulfill({
        json: {
          id: 'session-new',
          history: [
            { info: { id: 'msg-new-1', role: 'user' }, parts: [{ type: 'text', text: 'First Message Edited' }] }
          ]
        }
      })
    })

    // Mock Prompt on New Session
    let promptedSession = ''
    await page.route('**/api/sessions/session-new/prompt*', async (route) => {
      promptedSession = 'session-new'
      await route.fulfill({
        json: {
          info: { id: 'msg-reply', role: 'assistant' },
          parts: []
        }
      })
    })

    // Go to session-123
    await page.goto(`/?folder=${encodeURIComponent(testDir)}&session=session-123`)

    // Edit first message
    const msg1 = page.locator(':text("First Message")').first()
    await msg1.hover()
    const editBtn = page.locator('button[title="Edit this message"]').first()
    await editBtn.click()

    await page.fill('textarea', 'First Message Edited')
    await page.click('button:has-text("Send")')

    // Verify URL changed to new session
    await expect(page).toHaveURL(/session=session-new/)

    // Verify new session was prompted
    await expect.poll(() => promptedSession).toBe('session-new')
  })

  test('edits a subsequent message and branches current session', async ({ page }) => {
    // Mock Status
    await page.route('**/api/sessions/*/status*', async (route) => {
      await route.fulfill({ json: { status: 'idle' } })
    })

    // Mock Branch Endpoint
    let branchPayload: any
    await page.route('**/api/sessions/session-123/branch*', async (route) => {
      branchPayload = route.request().postDataJSON()
      await route.fulfill({
        json: {
          id: 'session-branched',
          history: [
            { info: { id: 'msg-1', role: 'user' }, parts: [{ type: 'text', text: 'Message 1' }] },
            { info: { id: 'msg-2-new', role: 'user' }, parts: [{ type: 'text', text: 'Message 2 Edited' }] }
          ]
        }
      })
    })

    // Mock Get for the New (Branched) Session
    await page.route('**/api/sessions/session-branched*', async (route) => {
      await route.fulfill({
        json: {
          id: 'session-branched',
          history: [
            { info: { id: 'msg-1', role: 'user' }, parts: [{ type: 'text', text: 'Message 1' }] },
            { info: { id: 'msg-2-new', role: 'user' }, parts: [{ type: 'text', text: 'Message 2 Edited' }] }
          ]
        }
      })
    })

    // Initial State (Session 123)
    await page.route('**/api/sessions/session-123*', async (route) => {
      await route.fulfill({
        json: {
          id: 'session-123',
          history: [
            {
              info: { id: 'msg-1', role: 'user', time: { created: 1000 } },
              parts: [{ type: 'text', text: 'Message 1' }]
            },
            {
              info: { id: 'msg-2', role: 'user', time: { created: 2000 } },
              parts: [{ type: 'text', text: 'Message 2' }]
            }
          ]
        }
      })
    })

    await page.goto(`/?folder=${encodeURIComponent(testDir)}&session=session-123`)

    // Edit second message (Message 2)
    const msg2 = page.locator(':text("Message 2")').first()
    await msg2.hover()
    const editBtn = page.locator('button[title="Edit this message"]').nth(1) // 2nd message
    await editBtn.click()

    await page.fill('textarea', 'Message 2 Edited')
    await page.click('button:has-text("Send")')

    // Verify Branch was called with correct parent message ID (msg-1)
    await expect
      .poll(() => branchPayload)
      .toEqual(
        expect.objectContaining({
          messageID: 'msg-1',
          parts: [{ type: 'text', text: 'Message 2 Edited' }]
        })
      )

    // Verify redirected to new session
    await expect(page).toHaveURL(/session=session-branched/)

    // Verify history integrity (First message should still be visible)
    await expect(page.locator(':text("Message 1")').first()).toBeVisible()
    // And the new message
    await expect(page.locator(':text("Message 2 Edited")').first()).toBeVisible()
  })
})
