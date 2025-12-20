import { Tag, Task } from '../types'

const API_BASE = '/api'

export async function getTasks(folder: string): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json() as Promise<Task[]>
}

export async function createTask(folder: string, task: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task)
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json() as Promise<Task>
}

export async function updateTask(folder: string, id: string, updates: Partial<Task>): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}?folder=${encodeURIComponent(folder)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!res.ok) throw new Error('Failed to update task')
}

export async function deleteTask(folder: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}?folder=${encodeURIComponent(folder)}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete task')
}

export async function getTags(folder: string): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/tags?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to fetch tags')
  return res.json() as Promise<Tag[]>
}

export async function createTag(folder: string, tag: Partial<Tag>): Promise<Tag> {
  const res = await fetch(`${API_BASE}/tags?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tag)
  })
  if (!res.ok) throw new Error('Failed to create tag')
  return res.json() as Promise<Tag>
}

export async function addTaskTag(folder: string, taskId: string, tagId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/tags?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_id: tagId })
  })
  if (!res.ok) throw new Error('Failed to add tag to task')
}

export async function removeTaskTag(folder: string, taskId: string, tagId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/tags/${tagId}?folder=${encodeURIComponent(folder)}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to remove tag from task')
}
