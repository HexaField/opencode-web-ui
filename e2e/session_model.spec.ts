import { expect, test } from '@playwright/test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

const TEST_DIR_PREFIX = 'opencode-e2e-session-model-'

test.describe('Session Model Inheritance', () => {
  let testDir: string

  test.beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), TEST_DIR_PREFIX))
    await fs.writeFile(path.join(testDir, 'package.json'), '{}')
  })

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup test dir:', e)
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Connect to the test folder
    await page.fill('input[placeholder="Enter path..."]', testDir)
    await page.click('button:has-text("Go")')
    await page.click('button:has-text("Select this folder")')
    await expect(page.getByText('Sessions')).toBeVisible()
  })

  test('should use agent model when creating a session', async ({ page }) => {
    const agentName = 'model-test-agent'
    // Create an agent with a specific model if available, or just verify the flow
    // Since we can't easily guarantee models exist in this env without mocking effectively at e2e level,
    // we'll rely on the logic that setting it in the UI should theoretically propagate.
    // However, the backend might reject invalid models if we use real ones.
    // Let's assume 'gpt-4o' or similar might exist or we can just check what the backend returns if we mock/spy.
    // Actually, let's just stick to what the UI does.

    // Better approach: Stub the listModels response to include a specific test model
    await page.route('**/api/models', async (route) => {
      await route.fulfill({ json: ['test-model-v1', 'gpt-4o'] })
    })

    // Create Agent
    await page.getByTitle('Manage Agents').click()
    await page.getByRole('button', { name: 'New Agent' }).click()
    await page.getByLabel('Name').fill(agentName)
    await page.getByLabel('System Prompt').fill('You are a test agent')

    // Select the test model
    // Wait for the select to be populated (after our mock)
    const modelSelect = page.getByLabel('Model')
    await expect(modelSelect).toContainText('test-model-v1')
    await modelSelect.selectOption('test-model-v1')

    const savePromise = page.waitForResponse(
      (response) => response.url().includes('/api/agents') && response.status() === 200
    )
    await page.getByRole('button', { name: 'Save Agent' }).click()
    await savePromise

    // Close modal
    await page.locator('.fixed.inset-0 .border-b button').last().click()

    // Wait for the agent to appear in the dropdown
    const select = page.locator('select')
    await expect(select).toContainText(agentName)

    // Create Session with this agent
    await select.selectOption(agentName)

    // Check if the default model for the session (if valid) reflects the agent's model?
    // In the UI, usually the session creation might just pick the agent.
    // Let's create the session and inspect the payload or the result.

    const createPromise = page.waitForResponse(
      (res) => res.url().includes('/api/sessions') && res.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'New Session' }).click()
    const response = await createPromise
    const sessionData = await response.json()
    console.log('Session Data:', sessionData)

    // This is where we expect failure based on the user report
    expect(sessionData.model).toBe('test-model-v1')
  })
})
