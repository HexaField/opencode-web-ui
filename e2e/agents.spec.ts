import { expect, test } from '@playwright/test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

const TEST_DIR_PREFIX = 'opencode-e2e-agents-'

test.describe('Agent Management', () => {
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
    // Wait for the workspace to load (SessionList should be visible)
    await expect(page.getByText('Sessions')).toBeVisible()
  })

  test('should list default agents', async ({ page }) => {
    // Open Agent Manager
    await page.getByTitle('Manage Agents').click()

    // Check for default agents using specific locator
    // The list is in a div with space-y-1
    const agentList = page.locator('div.space-y-1 > div > span.truncate')
    await expect(agentList.getByText('build', { exact: true })).toBeVisible()
    await expect(agentList.getByText('plan', { exact: true })).toBeVisible()
    await expect(agentList.getByText('general', { exact: true })).toBeVisible()
    await expect(agentList.getByText('explore', { exact: true })).toBeVisible()
  })

  test('should create, edit, and delete an agent', async ({ page }) => {
    const agentName = 'e2e-test-agent'
    const agentDesc = 'An agent created by E2E tests'
    const updatedDesc = 'Updated description'

    // Open Agent Manager
    await page.getByTitle('Manage Agents').click()

    // Create new agent
    await page.getByRole('button', { name: 'New Agent' }).click()

    // Fill form
    await page.getByLabel('Name').fill(agentName)
    await page.getByLabel('Description').fill(agentDesc)

    // Check model dropdown has options (fetched from backend)
    const modelSelect = page.getByLabel('Model')
    await expect(modelSelect).toBeVisible()
    // Wait for models to load (fetch) - should have more than just "Default"
    // We use toPass() to retry until the fetch completes and populates the dropdown
    await expect(async () => {
      const count = await modelSelect.locator('option').count()
      expect(count).toBeGreaterThan(1)
    }).toPass()

    // Save and wait for response
    const savePromise = page.waitForResponse(
      (response) => response.url().includes('/api/agents') && response.status() === 200
    )
    await page.getByRole('button', { name: 'Save Agent' }).click()
    await savePromise

    // Verify agent is in the list
    const agentList = page.locator('div.space-y-1 > div > span.truncate')
    await expect(agentList.getByText(agentName)).toBeVisible()

    // Edit agent
    await agentList.getByText(agentName).click()
    await expect(page.getByLabel('Description')).toHaveValue(agentDesc)

    await page.getByLabel('Description').fill(updatedDesc)
    await page.getByRole('button', { name: 'Save Agent' }).click()

    // Wait for edit mode to close
    await expect(page.getByRole('button', { name: 'Save Agent' })).not.toBeVisible()

    // Verify update (click again to check)
    await agentList.getByText(agentName).click()
    await expect(page.getByLabel('Description')).toHaveValue(updatedDesc)

    // Close Agent Manager (click the X button in the header)
    // Scope to the modal (.fixed.inset-0) to avoid clicking buttons behind it
    await page.locator('.fixed.inset-0 .border-b button').last().click()

    // Verify agent is available in Session List dropdown
    const select = page.locator('select')
    await expect(select).toContainText(agentName)

    // Delete agent
    await page.getByTitle('Manage Agents').click()

    // Trigger delete
    // We need to hover over the list item to see the delete button
    const agentItem = page.locator('div.space-y-1 > div').filter({ hasText: agentName })
    await agentItem.hover()

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Click the delete button (trash icon)
    await agentItem.locator('button').click()

    // Verify agent is gone
    await expect(agentList.getByText(agentName)).not.toBeVisible()
  })
})
