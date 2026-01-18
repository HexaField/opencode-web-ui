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

export async function abortSession(folder: string, id: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/sessions/${id}/abort?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  if (!res.ok) throw new Error('Failed to abort session')
  return res.json() as Promise<unknown>
}

export async function getSessionStatus(folder: string, id: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/sessions/${id}/status?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to get session status')
  return res.json() as Promise<{ status: string }>
}

export async function revertSession(folder: string, id: string, messageID?: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/sessions/${id}/revert?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageID })
  })
  if (!res.ok) throw new Error('Failed to revert session')
  return res.json()
}

export async function unrevertSession(folder: string, id: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/sessions/${id}/unrevert?folder=${encodeURIComponent(folder)}`, {
    method: 'POST'
  })
  if (!res.ok) throw new Error('Failed to unrevert session')
  return res.json()
}
