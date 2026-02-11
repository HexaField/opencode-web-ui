const API_BASE = '/api'

export interface WorkspaceMetadata {
  path: string
  name: string
  description?: string
  lastOpened: string
  tags: string[]
  techStack?: string[]
}

export interface DashboardData {
  workspaces: WorkspaceMetadata[]
  homePath: string
}

export async function getDashboardData(): Promise<DashboardData> {
  const res = await fetch(`${API_BASE}/workspaces`)
  if (!res.ok) throw new Error('Failed to load workspaces')
  return await res.json()
}

export async function getRecentWorkspaces(): Promise<WorkspaceMetadata[]> {
  const data = await getDashboardData()
  return data.workspaces
}

export async function getTemplates(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/templates`)
  if (!res.ok) throw new Error('Failed to load templates')
  const data = await res.json()
  return data.templates
}

export async function createProject(template: string, path: string): Promise<{ success: boolean; path: string }> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template, path })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create project')
  }
  return res.json()
}
