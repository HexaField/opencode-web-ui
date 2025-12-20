import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const testFolder = path.join(os.tmpdir(), 'opencode-e2e-deps-' + Date.now())

test.describe('Task Dependencies', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true })
      try {
        execSync('git init', { cwd: testFolder })
        execSync('git commit --allow-empty -m "Initial commit"', { cwd: testFolder })
        const projectName = 'e2e-deps-' + Date.now()
        execSync(
          `rad init --name ${projectName} --description "E2E Deps" --default-branch main --public --no-confirm`,
          { cwd: testFolder }
        )
      } catch (e) {
        console.error('Failed to init repo', e)
        throw e
      }
    }
  })

  test.afterAll(() => {
    if (fs.existsSync(testFolder)) {
      fs.rmSync(testFolder, { recursive: true, force: true })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/?folder=${encodeURIComponent(testFolder)}&view=plan`)
  })

  test.fixme('should allow adding and removing dependencies', async ({ page }) => {
    // Wait for load
    await expect(page.getByPlaceholder('Add a new task...')).toBeVisible()

    // Create Task A
    await page.getByPlaceholder('Add a new task...').fill('Task A')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Task A')).toBeVisible()

    // Create Task B
    await page.getByPlaceholder('Add a new task...').fill('Task B')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Task B')).toBeVisible()

    // Wait a bit for state to settle
    await page.waitForTimeout(1000)

    // Open dependency modal for Task A
    // Hover over Task A to reveal buttons
    await page.getByText('Task A').hover()

    // Click the dependency button (it has title "Manage Dependencies")
    await page.locator('button[title="Manage Dependencies"]').first().click()

    // Check modal is open
    await expect(page.getByText('Manage Dependencies')).toBeVisible()

    // Wait for "Task B" to appear in the modal
    // We scope to the modal to avoid finding the task in the background list
    const modal = page.locator('.fixed')
    await expect(modal.getByText('Task B')).toBeVisible()

    // Check Task B checkbox
    // Since the input is inside the label with the text, getByLabel should work
    const checkbox = modal.getByLabel('Task B')
    await checkbox.check()

    // Close modal
    // The close button is the one in the header. It's the first button in the modal.
    // We can target it by the SVG inside or just use the first button in the modal container.
    // But there might be multiple buttons on the page.
    // Let's use a more specific selector.
    await page.locator('.fixed button').first().click()

    // Wait for update
    await page.waitForTimeout(1000)

    // Reload to verify persistence
    await page.reload()

    // Open modal again for Task A
    await page.getByText('Task A').hover()
    await page.locator('button[title="Manage Dependencies"]').first().click()

    // Verify Task B is checked
    // We need to re-locate the checkbox because the page reloaded
    const checkboxAfterReload = page.locator('.fixed').getByLabel('Task B')
    await expect(checkboxAfterReload).toBeChecked()

    // Uncheck Task B
    await checkboxAfterReload.uncheck()

    // Close modal
    await page.locator('.fixed button').first().click()

    // Wait for update
    await page.waitForTimeout(1000)

    // Reload
    await page.reload()

    // Open modal again
    await page.getByText('Task A').hover()
    await page.locator('button[title="Manage Dependencies"]').first().click()

    // Verify Task B is unchecked
    const checkboxFinal = page.locator('.fixed').getByLabel('Task B')
    await expect(checkboxFinal).not.toBeChecked()
  })
})
