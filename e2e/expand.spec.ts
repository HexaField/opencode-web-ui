import { expect, test } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const testFolder = path.join(os.tmpdir(), 'opencode-e2e-expand-' + Date.now())

test.describe('Task Expansion and Description', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true })
      try {
        execSync('git init', { cwd: testFolder })
        execSync('git commit --allow-empty -m "Initial commit"', { cwd: testFolder })
        const projectName = 'e2e-expand-' + Date.now()
        execSync(
          `rad init --name ${projectName} --description "E2E Expand" --default-branch main --public --no-confirm`,
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

  test('should allow expanding a task and editing description', async ({ page }) => {
    // Wait for load
    await expect(page.getByPlaceholder('Add a new task...')).toBeVisible()

    // Create Task
    await page.getByPlaceholder('Add a new task...').fill('Task with Description')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Task with Description')).toBeVisible()

    // Expand task
    // The chevron is a button with an SVG inside. We can find it by the SVG path or just the button.
    // Since it's the first button in the row (before the bullet), we can try to locate it.
    // Or we can look for the button that toggles expansion.
    // It has class 'transition-transform'.

    const expandButton = page.locator('button.transition-transform').first()
    await expandButton.click()

    // Check if textarea is visible
    const textarea = page.getByPlaceholder('Add a description...')
    await expect(textarea).toBeVisible()

    // Edit description
    await textarea.fill('This is a multi-line\ndescription.')

    // Trigger save (blur) and wait for response
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/tasks') && response.status() === 200)
    await textarea.blur()
    await responsePromise

    // Reload to verify persistence
    await page.reload()

    // Task should be collapsed by default on reload (since state is local)
    await expect(textarea).not.toBeVisible()

    // Expand again
    await expandButton.click()

    // Verify description content
    await expect(textarea).toHaveValue('This is a multi-line\ndescription.')
  })
})
