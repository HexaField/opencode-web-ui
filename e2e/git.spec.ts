import { expect, test } from '@playwright/test'
import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TEST_DIR_PREFIX = 'opencode-e2e-git-'

test.describe('Git Integration E2E', () => {
  let testDir: string

  test.beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), TEST_DIR_PREFIX))
    await execAsync('git init', { cwd: testDir })
    await execAsync('git config user.email "e2e@example.com"', { cwd: testDir })
    await execAsync('git config user.name "E2E User"', { cwd: testDir })
    await fs.writeFile(path.join(testDir, 'README.md'), '# E2E Repo')
    await execAsync('git add .', { cwd: testDir })
    await execAsync('git commit -m "Initial commit"', { cwd: testDir })
  })

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (e) {
      console.error('Failed to cleanup test dir:', e)
    }
  })

  test('git workflow', async ({ page }) => {
    // 1. Open the project
    await page.goto(`/?folder=${encodeURIComponent(testDir)}`)

    // 2. Switch to Changes tab
    await page.click('button:has-text("Changes")')

    // 3. Verify no changes initially
    await expect(page.getByText('No changes detected')).toBeVisible()

    // 4. Create a new file
    const newFile = path.join(testDir, 'feature.txt')
    await fs.writeFile(newFile, 'New Feature')

    // 5. Refresh/Wait for UI to update (it polls or we might need to trigger it)
    // The DiffView uses createEffect but doesn't seem to poll.
    // Wait, createEffect runs once on mount. It doesn't poll.
    // We might need to reload the page or switch tabs to refresh.
    // Let's try reloading the page for now as the simplest way to refresh state.
    await page.reload()
    await page.click('button:has-text("Changes")')

    // 6. Verify file appears in Changes (Unstaged)
    // It should be under "Changes" section
    await expect(page.getByText('feature.txt')).toBeVisible()
    // Check status icon/text (A or ?)
    // The UI shows '?' for untracked

    // 7. Stage the file
    // Find the checkbox associated with feature.txt
    // We can find the row containing 'feature.txt' and then the checkbox within it
    const fileRow = page.locator('div').filter({ hasText: 'feature.txt' }).last()
    await fileRow.getByRole('checkbox').check()

    // 8. Verify it moved to Staged Changes
    // We should see "Staged Changes" header
    await expect(page.getByText('Staged Changes')).toBeVisible()

    // 9. Commit
    await page.fill('textarea[placeholder*="Message"]', 'Add feature.txt')
    await page.click('button:has-text("Commit")')

    // Wait for message to be cleared (indicates commit started/finished)
    await expect(page.locator('textarea[placeholder*="Message"]')).toBeEmpty()

    // 10. Verify changes are gone
    await expect(page.getByText('No changes detected')).toBeVisible({ timeout: 10000 })

    // 11. Verify commit in backend
    const { stdout } = await execAsync('git log -1 --pretty=%s', { cwd: testDir })
    expect(stdout.trim()).toBe('Add feature.txt')

    // 12. Create a branch in backend and verify UI picks it up
    await execAsync('git checkout -b new-branch', { cwd: testDir })
    await page.reload()
    await page.click('button:has-text("Changes")')

    // Check the select value
    const branchSelect = page.locator('select').first()
    await expect(branchSelect).toHaveValue('new-branch')
  })
})
