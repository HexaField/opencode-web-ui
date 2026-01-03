import type { FSWriteRequest } from '../../server/types'

const API_BASE = '/api'

export interface FileStatus {
  path: string
  status: string
}

export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface DiffSummary {
  filesChanged: number
  added: number
  removed: number
  details: { path: string; added: number; removed: number }[]
}

export async function getFileStatus(folder: string): Promise<FileStatus[]> {
  const res = await fetch(`${API_BASE}/files/status?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get file status')
  return res.json() as Promise<FileStatus[]>
}

export async function readFile(folder: string, path: string): Promise<{ content: string }> {
  const res = await fetch(
    `${API_BASE}/files/read?folder=${encodeURIComponent(folder)}&path=${encodeURIComponent(path)}`
  )
  if (!res.ok) throw new Error('Failed to read file')
  return res.json() as Promise<{ content: string }>
}

export async function listFiles(path?: string): Promise<{ files: FileEntry[]; currentPath: string }> {
  const url = path ? `${API_BASE}/fs/list?path=${encodeURIComponent(path)}` : `${API_BASE}/fs/list`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to list files')
  const currentPath = res.headers.get('x-current-path') || ''
  const files = (await res.json()) as FileEntry[]
  return { files, currentPath }
}

export async function readFSFile(path: string): Promise<{ content: string }> {
  const res = await fetch(`${API_BASE}/fs/read?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error('Failed to read fs file')
  return res.json() as Promise<{ content: string }>
}

export async function writeFile(path: string, content: string): Promise<void> {
  const body: FSWriteRequest['body'] = { path, content }
  const res = await fetch(`${API_BASE}/fs/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to write file')
  return res.json() as Promise<void>
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/fs/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  })
  if (!res.ok) throw new Error('Failed to delete file')
  return res.json() as Promise<void>
}

export async function getFileDiff(folder: string, path: string): Promise<{ diff: string; stderr?: string }> {
  const res = await fetch(
    `${API_BASE}/files/diff?folder=${encodeURIComponent(folder)}&path=${encodeURIComponent(path)}`
  )
  if (!res.ok) throw new Error('Failed to get file diff')
  return res.json() as Promise<{ diff: string; stderr?: string }>
}

export async function getDiffSummary(folder: string): Promise<DiffSummary> {
  const res = await fetch(`${API_BASE}/files/diff-summary?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get diff summary')
  return res.json() as Promise<DiffSummary>
}
