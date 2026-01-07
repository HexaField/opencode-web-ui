import { spawn, spawnSync } from 'child_process'
import * as path from 'path'

export type GitCommitInfo = {
  hash: string
  message: string
  authorName: string
  authorEmail: string
  timestamp: string
}

export type GitLogOptions = {
  repoPath: string
  branch: string
  limit?: number
}

const DEFAULT_COMMIT_LIMIT = 25

export type RunGitCommandOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export type RunGitCommandSyncOptions = RunGitCommandOptions & {
  stdio?: 'inherit' | 'pipe'
}

export async function runGitCommand(args: string[], cwd: string, options: RunGitCommandOptions = {}): Promise<string> {
  const resolvedCwd = path.resolve(options.cwd ?? cwd)
  return await new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: resolvedCwd, env: options.env ?? process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr.trim() || stdout.trim() || `git ${args.join(' ')} failed with code ${code}`))
      }
    })
  })
}

export function runGitCommandSync(args: string[], cwd: string, options: RunGitCommandSyncOptions = {}): string {
  const resolvedCwd = path.resolve(options.cwd ?? cwd)
  const stdio = options.stdio ?? 'pipe'
  const result = spawnSync('git', args, {
    cwd: resolvedCwd,
    env: options.env ?? process.env,
    stdio,
    encoding: 'utf8'
  })
  if (result.error) {
    throw result.error
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : ''
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : ''
    const detail = stderr || stdout || `git ${args.join(' ')} failed with code ${result.status}`
    throw new Error(detail)
  }
  return typeof result.stdout === 'string' ? result.stdout : ''
}

export async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const branch = await runGitCommand(['branch', '--show-current'], repoPath)
    return branch.trim()
  } catch {
    return ''
  }
}

export async function listGitBranches(repoPath: string): Promise<string[]> {
  try {
    const raw = await runGitCommand(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], repoPath)
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length)
  } catch {
    return []
  }
}

export async function listBranchCommits(options: GitLogOptions): Promise<GitCommitInfo[]> {
  const { repoPath, branch, limit = DEFAULT_COMMIT_LIMIT } = options
  const format = '%H%x1f%an%x1f%ae%x1f%aI%x1f%s'
  try {
    const raw = await runGitCommand(
      ['log', '--date-order', '-n', String(limit), '--date=iso-strict', `--pretty=format:${format}`, branch],
      repoPath
    )
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length)
      .map((line) => {
        const [hash, authorName, authorEmail, timestamp, message] = line.split('\x1f')
        return {
          hash,
          authorName,
          authorEmail,
          timestamp,
          message
        }
      })
  } catch {
    return []
  }
}

export type GitFileStatus = {
  path: string
  x: string
  y: string
}

export async function getGitStatus(repoPath: string): Promise<GitFileStatus[]> {
  try {
    const raw = await runGitCommand(['status', '--porcelain'], repoPath)
    return raw
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const x = line[0]
        const y = line[1]
        const path = line.slice(3).trim()
        return { path, x, y }
      })
  } catch {
    return []
  }
}

export async function runCopilotPrompt(prompt: string, cwd: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const args = [
      'copilot',
      '-p',
      prompt,
      '--add-dir',
      cwd,
      '--allow-tool',
      'shell(git:status)',
      '--allow-tool',
      'shell(git:diff)',
      '--allow-tool',
      'shell(git:diff --staged)',
      '--silent'
    ]
    const child = spawn('npx', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    child.on('error', (error) => {
      reject(new Error(`Failed to spawn copilot: ${error.message}`))
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`Copilot failed with code ${code}: ${stderr}`))
      }
    })
  })
}

export async function findGitRepositories(rootDir: string): Promise<string[]> {
  const { stdout } = await spawnPromise(
    'find',
    [
      '.',
      '-name',
      'node_modules',
      '-prune', // Skip node_modules
      '-o',
      '-name',
      '.git',
      '-type',
      'd',
      '-print' // Find .git dirs
    ],
    { cwd: rootDir }
  )

  return (
    stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => path.dirname(path.resolve(rootDir, line)))
      // Return unique paths
      .filter((value, index, self) => self.indexOf(value) === index)
  )
}

function spawnPromise(
  cmd: string,
  args: string[],
  options: { cwd: string }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, options)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr || stdout))
    })
    child.on('error', reject)
  })
}
