import type {
  GitBranchRequest,
  GitCheckoutRequest,
  GitCommitRequest,
  GitPushPullRequest,
  GitStageRequest
} from '../../server/types'

const API_BASE = '/api'

export interface GitStatusItem {
  path: string
  x: string
  y: string
}

export async function getGitStatus(folder: string): Promise<GitStatusItem[]> {
  const res = await fetch(`${API_BASE}/git/status?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get git status')
  return res.json() as Promise<GitStatusItem[]>
}

export async function getCurrentBranch(folder: string): Promise<{ branch: string }> {
  const res = await fetch(`${API_BASE}/git/current-branch?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get current branch')
  return res.json() as Promise<{ branch: string }>
}

export async function listBranches(folder: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/git/branches?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to list branches')
  return res.json() as Promise<string[]>
}

export async function stageFiles(folder: string, files: string[]): Promise<void> {
  const body: GitStageRequest['body'] = { folder, files }
  const res = await fetch(`${API_BASE}/git/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to stage files')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function unstageFiles(folder: string, files: string[]): Promise<void> {
  const body: GitStageRequest['body'] = { folder, files }
  const res = await fetch(`${API_BASE}/git/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to unstage files')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function commit(folder: string, message: string): Promise<void> {
  const body: GitCommitRequest['body'] = { folder, message }
  const res = await fetch(`${API_BASE}/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to commit')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function generateCommitMessage(folder: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/git/generate-commit-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder })
  })
  if (!res.ok) throw new Error('Failed to generate commit message')
  return res.json() as Promise<{ message: string }>
}

export async function push(folder: string, remote?: string, branch?: string): Promise<void> {
  const body: GitPushPullRequest['body'] = { folder, remote, branch }
  const res = await fetch(`${API_BASE}/git/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to push')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function pull(folder: string, remote?: string, branch?: string): Promise<void> {
  const body: GitPushPullRequest['body'] = { folder, remote, branch }
  const res = await fetch(`${API_BASE}/git/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to pull')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function getAheadBehind(
  folder: string,
  remote?: string,
  branch?: string
): Promise<{ ahead: number; behind: number }> {
  const qs = new URLSearchParams()
  qs.set('folder', folder)
  if (remote) qs.set('remote', remote)
  if (branch) qs.set('branch', branch)
  const res = await fetch(`${API_BASE}/git/ahead-behind?${qs.toString()}`)
  if (!res.ok) throw new Error('Failed to get ahead/behind')
  return res.json() as Promise<{ ahead: number; behind: number }>
}

export async function checkout(folder: string, branch: string): Promise<void> {
  const body: GitCheckoutRequest['body'] = { folder, branch }
  const res = await fetch(`${API_BASE}/git/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to checkout')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function createBranch(folder: string, branch: string, from?: string): Promise<void> {
  const body: GitBranchRequest['body'] = { folder, branch, from }
  const res = await fetch(`${API_BASE}/git/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to create branch')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function merge(folder: string, branch: string): Promise<void> {
  const body: GitCheckoutRequest['body'] = { folder, branch } // Reusing checkout schema as it has folder and branch
  const res = await fetch(`${API_BASE}/git/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to merge')
  await res.json()
  try {
    window.dispatchEvent(new Event('git-updated'))
  } catch (err) {
    void err
  }
  return
}

export async function findRepos(folder: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/git/repos?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to find repos')
  return res.json() as Promise<string[]>
}
