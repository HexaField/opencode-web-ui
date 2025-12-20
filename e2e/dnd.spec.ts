import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const testFolder = path.join(os.tmpdir(), 'opencode-e2e-dnd-' + Date.now())

test.describe('Task Drag and Drop', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true })
      try {
        execSync('git init', { cwd: testFolder })
        execSync('git commit --allow-empty -m "Initial commit"', { cwd: testFolder })
        const projectName = 'e2e-dnd-' + Date.now()
        execSync(
          `rad init --name ${projectName} --description "E2E DnD" --default-branch main --public --no-confirm`,
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

  test('should allow nesting and un-nesting tasks via drag and drop', async ({ page }) => {
    // Wait for load
    await expect(page.getByPlaceholder('Add a new task...')).toBeVisible()

    // Create Parent Task
    await page.getByPlaceholder('Add a new task...').fill('Parent Task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Parent Task')).toBeVisible()

    // Create Child Task
    await page.getByPlaceholder('Add a new task...').fill('Child Task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Child Task')).toBeVisible()

    // Drag Child Task onto Parent Task
    await page.getByText('Child Task').dragTo(page.getByText('Parent Task'))

    // Wait for update
    await page.waitForTimeout(1000)

    // Verify nesting
    const nestedChild = page.locator('.ml-6').getByText('Child Task')
    await expect(nestedChild).toBeVisible()

    // Reload to verify persistence
    await page.reload()
    await expect(page.getByText('Parent Task')).toBeVisible()
    await expect(nestedChild).toBeVisible()

    // Un-nest: Drag Child Task to the root drop zone
    // We need to trigger the drop zone visibility first
    await page.getByText('Child Task').hover()
    await page.mouse.down()
    await page.mouse.move(100, 100)
    await page.waitForTimeout(500)
    
    const dropZone = page.getByText('Drag here to make a root task')
    await expect(dropZone).toBeVisible()
    
    await dropZone.hover()
    await page.mouse.up()
    
    // Wait for update
    await page.waitForTimeout(1000)
    
    // Verify un-nesting
    await expect(page.locator('.ml-6').getByText('Child Task')).not.toBeVisible()
    await expect(page.getByText('Child Task')).toBeVisible()
  })
})
