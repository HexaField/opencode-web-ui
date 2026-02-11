import type { ConnectRequest } from '../../server/types'

const API_BASE = '/api'

export async function connect(folder: string): Promise<{ success: boolean; folder: string }> {
  const body: ConnectRequest['body'] = { folder }
  const res = await fetch(`${API_BASE}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to connect')
  return res.json() as Promise<{ success: boolean; folder: string }>
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/models`)
  if (!res.ok) throw new Error('Failed to list models')
  return res.json() as Promise<string[]>
}

export async function searchKnowledgeBase(query: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/rag/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  const json = await res.json()
  return json.results
}
