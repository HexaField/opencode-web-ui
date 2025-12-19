import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk'
import { spawn, type ChildProcess, exec as _exec } from 'child_process'
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
      const targetDir = process.env.OPENCODE_WORKER_DIR!
      process.chdir(targetDir)

      // Start OpenCode server on a random port
      const { server } = await createOpencode({
        port: 0 // Random port
        // We might need to suppress logs if they interfere with our stdout JSON
        // But createOpencode might log to stdout.
        // We'll try to capture the specific output we need.
      })

      // Send the URL back to the parent
      console.log(JSON.stringify({ type: 'ready', url: server.url }))

      // Keep process alive
      // The server.close() is available if we need it, but here we just wait.
    } catch (error) {
      console.error(error)
      process.exit(1)
    }
  })().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

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
        stdio: ['ignore', 'pipe', 'inherit'] // Pipe stdout to capture URL, inherit stderr for debugging
      })

      let started = false

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
        if (!started) reject(new Error(`Worker exited with code ${code}`))
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

  async listModels() {
    try {
      const { stdout } = await exec('opencode models')
      return stdout.split('\n').filter(Boolean).map(m => m.trim())
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
