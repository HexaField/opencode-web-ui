import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  getCurrentBranch,
  getGitStatus,
  listBranchCommits,
  listGitBranches,
  runGitCommand,
  runGitCommandSync
} from '../src/git.js'

const execAsync = promisify(exec)

describe('Git Module Tests', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-git-test-'))
    await execAsync(`git init`, { cwd: tempDir })
    await execAsync(`git config user.name "Test User"`, { cwd: tempDir })
    await execAsync(`git config user.email "test@example.com"`, { cwd: tempDir })
    // Initial commit to have a branch
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Repo')
    await execAsync(`git add .`, { cwd: tempDir })
    await execAsync(`git commit -m "Initial commit"`, { cwd: tempDir })
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should run arbitrary git commands', async () => {
    const output = await runGitCommand(['status'], tempDir)
    expect(output).toContain('On branch')
  })

  it('should run synchronous git commands', () => {
    const output = runGitCommandSync(['status'], tempDir)
    expect(output).toContain('On branch')
  })

  it('should get current branch', async () => {
    const branch = await getCurrentBranch(tempDir)
    // Default could be master or main depending on git config, but we can check it's not empty
    expect(branch).toBeTruthy()
  })

  it('should list branches', async () => {
    // Create a new branch
    await execAsync(`git checkout -b feature-test`, { cwd: tempDir })
    const branches = await listGitBranches(tempDir)
    expect(branches).toContain('feature-test')

    // Switch back
    await execAsync(`git checkout -`, { cwd: tempDir })
  })

  it('should list branch commits', async () => {
    const branch = await getCurrentBranch(tempDir)
    const commits = await listBranchCommits({ repoPath: tempDir, branch })
    expect(commits.length).toBeGreaterThan(0)
    expect(commits[0].message).toBe('Initial commit')
    expect(commits[0].authorName).toBe('Test User')
  })

  it('should detect file status changes', async () => {
    // 1. Create a new file (Untracked)
    const newFile = path.join(tempDir, 'new.txt')
    await fs.writeFile(newFile, 'content')

    let status = await getGitStatus(tempDir)
    let fileStatus = status.find((s) => s.path === 'new.txt')
    expect(fileStatus).toBeDefined()
    expect(fileStatus?.x).toBe('?')
    expect(fileStatus?.y).toBe('?')

    // 2. Stage the file (Added)
    await execAsync(`git add new.txt`, { cwd: tempDir })
    status = await getGitStatus(tempDir)
    fileStatus = status.find((s) => s.path === 'new.txt')
    expect(fileStatus?.x).toBe('A')

    // 3. Commit
    await execAsync(`git commit -m "Add new.txt"`, { cwd: tempDir })
    status = await getGitStatus(tempDir)
    fileStatus = status.find((s) => s.path === 'new.txt')
    expect(fileStatus).toBeUndefined() // Clean working tree

    // 4. Modify the file
    await fs.writeFile(newFile, 'modified content')
    status = await getGitStatus(tempDir)
    fileStatus = status.find((s) => s.path === 'new.txt')
    expect(fileStatus?.y).toBe('M') // Modified in working tree

    // 5. Stage modification
    await execAsync(`git add new.txt`, { cwd: tempDir })
    status = await getGitStatus(tempDir)
    fileStatus = status.find((s) => s.path === 'new.txt')
    expect(fileStatus?.x).toBe('M') // Modified in index
  })
})
