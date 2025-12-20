import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const testFolder = path.join(os.tmpdir(), 'opencode-e2e-test-' + Date.now())

test.describe('Plan Tab', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(testFolder)) {
      fs.mkdirSync(testFolder, { recursive: true })
    }
  })

  test.afterAll(() => {
    // Cleanup
    if (fs.existsSync(testFolder)) {
      fs.rmSync(testFolder, { recursive: true, force: true })
    }
  })

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', exception => console.log(`PAGE ERROR: "${exception}"`));

    // Go to the app with the test folder and plan view
    await page.goto(`/?folder=${encodeURIComponent(testFolder)}&view=plan`)
  })

  test('should allow creating, nesting, and viewing tasks', async ({ page }) => {
    // Wait for Workspace to load
    await expect(page.locator('button:has-text("Chat")')).toBeVisible()

    // Check if PlanView container is present
    await expect(page.locator('#plan-view-container')).toBeVisible()

    // Create a task in List view
    const taskTitle = 'Parent Task ' + Date.now()
    await page.fill('input[placeholder="Add a new task..."]', taskTitle)
    await page.click('button:has-text("Add")')
    
    // Verify task is visible
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible()

    // Add a subtask
    const taskRow = page.locator(`div.group:has-text("${taskTitle}")`).first()
    await taskRow.hover()
    await taskRow.locator('button[title="Add Subtask"]').click()
    
    const subtaskTitle = 'Subtask ' + Date.now()
    await page.fill('input[placeholder="Subtask title..."]', subtaskTitle)
    
    // Click the "Add" button next to the subtask input
    await page.locator('input[placeholder="Subtask title..."]').locator('..').locator('button:has-text("Add")').click()

    // Verify subtask is visible
    await expect(page.locator(`text=${subtaskTitle}`)).toBeVisible()
    
    // Switch to Kanban view
    await page.click('button:has-text("Kanban")')
    
    // Verify tasks are visible in Kanban view
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible()
    await expect(page.locator(`text=${subtaskTitle}`)).toBeVisible()
    
    // Switch to DAG view
    await page.click('button:has-text("DAG")')
    
    // Verify DAG view loads (canvas exists)
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('should allow managing tags', async ({ page }) => {
    await expect(page.locator('button:has-text("Manage Tags")')).toBeVisible()
    await page.click('button:has-text("Manage Tags")')

    const tagName = 'Urgent ' + Date.now()
    await page.fill('input[placeholder="New tag name..."]', tagName)
    
    // Target Add button inside modal (sibling of input)
    await page.locator('input[placeholder="New tag name..."]').locator('..').locator('button:has-text("Add")').click()

    await expect(page.locator(`text=${tagName}`)).toBeVisible()
  })
})
