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

const DEFAULT_CONFIG: AgentConfig = {
  description: '',
  mode: 'primary',
  model: '',
  permission: {
    write: 'allow',
    edit: 'allow',
    bash: 'allow',
    webfetch: 'allow'
  }
}

export function parseAgent(content: string): { config: AgentConfig; prompt: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { config: { ...DEFAULT_CONFIG }, prompt: content.trim() }
  }

  const frontmatter = match[1]
  const prompt = match[2].trim()
  const config = { ...DEFAULT_CONFIG }

  // Simple manual YAML parsing for the specific structure we expect
  const lines = frontmatter.split('\n')
  let currentSection: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.endsWith(':') && !trimmed.includes(': ')) {
      // block start (e.g. "permission:")
      currentSection = trimmed.replace(':', '')
      continue
    }

    const parts = line.split(':')
    if (parts.length < 2) continue

    const key = parts[0].trim()
    const value = parts.slice(1).join(':').trim()

    if (currentSection === 'permission') {
      // @ts-expect-error - dynamic assignment
      if (key in config.permission) {
        // @ts-expect-error - dynamic assignment
        config.permission[key] = value
      }
    } else {
      if (key === 'description') config.description = value.replace(/^"|"$/g, '')
      if (key === 'mode') config.mode = value as 'primary' | 'subagent'
      if (key === 'model') config.model = value.replace(/^"|"$/g, '')
      // Handle flattened permission format if it exists (legacy/alternative)
      if (key === 'permission') {
        // If inline format? unlikely for multi-line but let's just ignore or handle if needed
      }
    }
  }

  // Re-scan for permission block if my simple parser failed or if indentation matters
  // Actually, let's use a slightly more robust regex approach for the permissions block
  const permissionMatch = frontmatter.match(/permission:\n([\s\S]*?)(?=\n\w+:|$)/)
  if (permissionMatch) {
    const permissionBlock = permissionMatch[1]
    permissionBlock.split('\n').forEach((line) => {
      const [pKey, pVal] = line.split(':').map((s) => s.trim())
      if (pKey && pVal && pKey in config.permission) {
        // @ts-expect-error - dynamic assignment
        config.permission[pKey] = pVal
      }
    })
  }

  return { config, prompt }
}

export function serializeAgent(config: AgentConfig, prompt: string): string {
  return `---
description: "${config.description}"
mode: ${config.mode}
model: "${config.model}"
permission:
  write: ${config.permission.write}
  edit: ${config.permission.edit}
  bash: ${config.permission.bash}
  webfetch: ${config.permission.webfetch}
---
${prompt}`
}
