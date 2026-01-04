import { createOpencodeClient } from '@opencode-ai/sdk'
import { exec as _exec } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { promisify } from 'util'

const exec = promisify(_exec)

export type OpencodeClient = ReturnType<typeof createOpencodeClient>

const DEFAULT_AGENTS = [
  {
    name: 'build',
    content: `---
description: The default primary agent with all tools enabled.
mode: primary
tools:
  write: true
  edit: true
  bash: true
  webfetch: true
---
You are the default build agent. You have full access to the system.`
  },
  {
    name: 'plan',
    content: `---
description: A restricted agent designed for planning and analysis.
mode: primary
tools:
  write: false
  edit: false
  bash: false
  webfetch: true
---
You are a planning agent. Analyze the request and provide a plan. Do not modify files.`
  },
  {
    name: 'general',
    content: `---
description: A general-purpose agent for researching complex questions.
mode: subagent
tools:
  write: true
  edit: true
  bash: true
  webfetch: true
---
You are a general purpose subagent.`
  },
  {
    name: 'explore',
    content: `---
description: A fast agent specialized for exploring codebases.
mode: subagent
tools:
  write: false
  edit: false
  bash: true
  webfetch: false
---
You are an exploration agent. Help the user find files and understand the codebase.`
  }
]

// Manager Logic
export class OpencodeManager {
  private client: OpencodeClient | null = null

  async connect(_folder: string): Promise<OpencodeClient> {
    void _folder
    await Promise.resolve()
    if (this.client) {
      return this.client
    }

    const url = process.env.OPENCODE_SERVER_URL
    if (!url) {
      throw new Error('OPENCODE_SERVER_URL environment variable is not set')
    }

    this.client = createOpencodeClient({
      baseUrl: url
    })

    return this.client
  }

  getClient(_folder: string): OpencodeClient | undefined {
    void _folder
    return this.client || undefined
  }

  async listAgents(folder: string) {
    const agentsDir = path.join(folder, '.opencode', 'agent')
    try {
      await fs.mkdir(agentsDir, { recursive: true })

      // Seed default agents
      for (const agent of DEFAULT_AGENTS) {
        const agentPath = path.join(agentsDir, `${agent.name}.md`)
        try {
          await fs.access(agentPath)
        } catch {
          await fs.writeFile(agentPath, agent.content)
        }
      }

      const files = await fs.readdir(agentsDir)
      const agents = []
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(agentsDir, file), 'utf-8')
          agents.push({ name: file.replace('.md', ''), content })
        }
      }
      return agents
    } catch {
      return []
    }
  }

  async saveAgent(folder: string, name: string, content: string) {
    const agentsDir = path.join(folder, '.opencode', 'agent')
    await fs.mkdir(agentsDir, { recursive: true })
    await fs.writeFile(path.join(agentsDir, `${name}.md`), content)
  }

  async deleteAgent(folder: string, name: string) {
    const agentPath = path.join(folder, '.opencode', 'agent', `${name}.md`)
    await fs.unlink(agentPath)
  }

  async getSessionMetadata(folder: string, sessionId: string) {
    try {
      const metadataPath = path.join(folder, '.opencode', 'sessions.json')
      const content = await fs.readFile(metadataPath, 'utf-8')
      const data = JSON.parse(content) as Record<string, unknown>
      return (data[sessionId] as Record<string, unknown>) || {}
    } catch {
      return {}
    }
  }

  async getAllSessionMetadata(folder: string) {
    try {
      const metadataPath = path.join(folder, '.opencode', 'sessions.json')
      const content = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(content) as Record<string, Record<string, unknown>>
    } catch {
      return {}
    }
  }

  async saveSessionMetadata(folder: string, sessionId: string, metadata: Record<string, unknown>) {
    const metadataPath = path.join(folder, '.opencode', 'sessions.json')
    let data: Record<string, unknown> = {}
    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      data = JSON.parse(content) as Record<string, unknown>
    } catch {
      // ignore
    }

    data[sessionId] = { ...(data[sessionId] as Record<string, unknown>), ...metadata }

    await fs.mkdir(path.dirname(metadataPath), { recursive: true })
    await fs.writeFile(metadataPath, JSON.stringify(data, null, 2))
  }

  async listModels() {
    try {
      const { stdout } = await exec('opencode models')
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((m) => m.trim())
    } catch (error) {
      console.error('Failed to list models:', error)
      return []
    }
  }

  shutdown() {
    this.client = null
  }
}
