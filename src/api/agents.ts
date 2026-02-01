import type { CreateAgentRequest } from '../../server/types'

const API_BASE = '/api'

export interface AgentPermission {
  write: string
  edit: string
  bash: string
  webfetch: string
}

export interface AgentConfig {
  description: string
  mode: 'primary' | 'subagent'
  model: string
  permission: AgentPermission
}

export interface Agent {
  name: string
  content: string
  config: AgentConfig
  prompt: string
}

export async function listAgents(folder: string): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents?folder=${encodeURIComponent(folder)}`)
  if (!res.ok) throw new Error('Failed to list agents')
  return res.json() as Promise<Agent[]>
}

export async function createAgent(folder: string, body: CreateAgentRequest['body']): Promise<void> {
  const res = await fetch(`${API_BASE}/agents?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error('Failed to create agent')
  return res.json() as Promise<void>
}

export async function deleteAgent(folder: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${name}?folder=${encodeURIComponent(folder)}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete agent')
  return res.json() as Promise<void>
}
