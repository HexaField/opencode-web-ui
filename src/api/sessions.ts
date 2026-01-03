import type { CreateSessionRequest, SessionPromptRequest, UpdateSessionRequest } from '../../server/types'
import type { Session } from '../types'

const API_BASE = '/api'

export async function listSessions(folder: string): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to list sessions')
  return res.json() as Promise<Session[]>
}

export async function createSession(folder: string, body: CreateSessionRequest['body']): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json() as Promise<Session>
}

export async function getSession(folder: string, id: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get session')
  return res.json() as Promise<Session>
}

export async function updateSession(folder: string, id: string, body: UpdateSessionRequest['body']): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}?folder=${encodeURIComponent(folder)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to update session')
  return res.json() as Promise<Session>
}

export async function promptSession(folder: string, id: string, body: SessionPromptRequest['body']): Promise<unknown> {
  const res = await fetch(`${API_BASE}/sessions/${id}/prompt?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to prompt session')
  return res.json() as Promise<unknown>
}
