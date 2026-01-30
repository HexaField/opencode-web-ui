import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk'
import { exec as _exec, spawn, type ChildProcess } from 'child_process'
import fg from 'fast-glob'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const exec = promisify(_exec)

export type OpencodeClient = ReturnType<typeof createOpencodeClient>

// Worker Logic
if (process.env.OPENCODE_WORKER_DIR) {
  ;(async () => {
    try {
      console.error('[Worker] Starting in', process.env.OPENCODE_WORKER_DIR)
      const targetDir = process.env.OPENCODE_WORKER_DIR!
      process.chdir(targetDir)

      // Start OpenCode server on a random port
      const { server } = await createOpencode({
        port: 0, // Random port
        timeout: 60000 // 60s timeout for tests
        // We might need to suppress logs if they interfere with our stdout JSON
        // But createOpencode might log to stdout.
        // We'll try to capture the specific output we need.
      })

      // Send the URL back to the parent
      console.log(JSON.stringify({ type: 'ready', url: server.url }))

      // Keep process alive
      // The server.close() is available if we need it, but here we just wait.
    } catch (error) {
      console.error('[Worker] Error:', error)
      process.exit(1)
    }
  })().catch((e) => {
    console.error('[Worker] Fatal:', e)
    process.exit(1)
  })
}

const DEFAULT_AGENTS = [
  {
    name: 'build',
    content: `---
description: The default primary agent with all tools enabled.
mode: primary
permission:
  write: allow
  edit: allow
  bash: allow
  webfetch: allow
---
You are the default build agent. You have full access to the system.`
  },
  {
    name: 'plan',
    content: `---
description: A restricted agent designed for planning and analysis.
mode: primary
permission:
  write: deny
  edit: deny
  bash: deny
  webfetch: allow
---
You are a planning agent. Analyze the request and provide a plan. Do not modify files.`
  },
  {
    name: 'general',
    content: `---
description: A general-purpose agent for researching complex questions.
mode: subagent
permission:
  write: allow
  edit: allow
  bash: allow
  webfetch: allow
---
You are a general purpose subagent.`
  },
  {
    name: 'explore',
    content: `---
description: A fast agent specialized for exploring codebases.
mode: subagent
permission:
  write: deny
  edit: deny
  bash: allow
  webfetch: deny
---
You are an exploration agent. Help the user find files and understand the codebase.`
  }
]

// Manager Logic
export class OpencodeManager {
  private clients = new Map<string, OpencodeClient>()
  private processes = new Map<string, ChildProcess>()

  async connect(folder: string): Promise<OpencodeClient> {
    if (this.clients.has(folder)) {
      return this.clients.get(folder)!
    }

    // Resolve absolute path
    const absFolder = path.resolve(folder)

    return new Promise((resolve, reject) => {
      const currentFile = fileURLToPath(import.meta.url)

      // Spawn this same file as a worker
      // We use process.execPath (node) and tsx loader
      const child = spawn(process.execPath, ['--import', 'tsx/esm', currentFile], {
        env: { ...process.env, OPENCODE_WORKER_DIR: absFolder },
        stdio: ['ignore', 'pipe', 'pipe'] // Capture stderr
      })

      let started = false
      let stderrOutput = ''

      child.stderr.on('data', (data: Buffer | string) => {
        const str = data.toString()
        stderrOutput += str
        process.stderr.write(data) // Pass through
      })

      child.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as { type: string; url: string }
            if (msg.type === 'ready' && msg.url) {
              const client = createOpencodeClient({
                baseUrl: msg.url
              })
              this.clients.set(folder, client)
              this.processes.set(folder, child)
              started = true
              resolve(client)
            }
          } catch {
            // Ignore non-JSON lines (logs)
          }
        }
      })

      child.on('error', (err) => {
        if (!started) reject(err)
      })

      child.on('exit', (code) => {
        this.clients.delete(folder)
        this.processes.delete(folder)
        if (!started) {
          console.error('Worker failed to start. Stderr:', stderrOutput)
          reject(new Error(`Worker exited with code ${code}. Stderr: ${stderrOutput}`))
        }
      })
    })
  }

  getClient(folder: string): OpencodeClient | undefined {
    return this.clients.get(folder)
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
    for (const child of this.processes.values()) {
      child.kill()
    }
    this.clients.clear()
    this.processes.clear()
  }
}
