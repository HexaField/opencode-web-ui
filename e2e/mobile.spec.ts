import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const testFolder = path.join(os.tmpdir(), 'opencode-e2e-mobile-' + Date.now() + '-' + Math.floor(Math.random() * 10000))

test.use({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true
})

test.describe('Mobile View', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true })
      try {
        execSync('git init', { cwd: testFolder })
        execSync('git commit --allow-empty -m "Initial commit"', { cwd: testFolder })
        const projectName = 'e2e-mobile-' + Date.now()
        execSync(
          `rad init --name ${projectName} --description "E2E Mobile" --default-branch main --public --no-confirm`,
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

  test('should show action buttons by default on mobile', async ({ page }) => {
    // Wait for load
    await expect(page.getByPlaceholder('Add a new task...')).toBeVisible()

    // Create Task
    await page.getByPlaceholder('Add a new task...').fill('Mobile Task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Mobile Task')).toBeVisible()

    // Check if action buttons are visible without hover
    // The container has class 'opacity-100' on mobile (default)
    // We can check if the "Manage Dependencies" button is visible
    const depsButton = page.locator('button[title="Manage Dependencies"]').first()
    await expect(depsButton).toBeVisible()

    // Check delete button
    const deleteButton = page.locator('button[title="Delete"]').first()
    await expect(deleteButton).toBeVisible()
  })

  test('should show terminal keyboard toggle on mobile', async ({ page }) => {
    await page.goto(`/?folder=${encodeURIComponent(testFolder)}&view=terminal`)

    // Check if the toggle button is visible
    const toggleButton = page.getByTitle('Toggle Keyboard')
    await expect(toggleButton).toBeVisible()

    // Click to ensure no errors
    await toggleButton.click()
  })
})
