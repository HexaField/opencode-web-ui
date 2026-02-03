import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk'
import { exec as _exec, spawn, type ChildProcess } from 'child_process'
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
    name: 'tdd-workflow',
    content: `---
description: Test-Driven Development Workflow (Worker -> Verifier Loop)
mode: primary
permission:
  write: allow
  edit: allow
  bash: allow
  webfetch: allow
---
{
  "id": "tdd-workflow",
  "description": "Iterative development loop where a Worker implements changes and a Verifier reviews them.",
  "roles": {
    "worker": {
      "systemPrompt": "You are a senior full-stack engineer and an expert in TDD, system architecture, and robust coding practices.\\nYour goal is to produce working, clean, and technically sound deliverables. Follow verifier instructions with discipline.\\n\\nAlways return STRICT JSON with the shape:\\n{\\n  \\"status\\": \\"working\\" | \\"done\\" | \\"blocked\\",\\n  \\"plan\\": \\"short bullet-style plan clarifying approach\\",\\n  \\"work\\": \\"precise description of what you produced or analysed\\",\\n  \\"requests\\": \\"questions or additional info you need (empty string if none)\\"\\n}\\n\\nRules:\\n- Think aloud inside the plan field; keep \\"work\\" actionable (code, commands, or decisions).\\n- Use status \\"done\\" only when you believe the user instructions are satisfied.\\n- Use status \\"blocked\\" when you cannot proceed without missing info; include what is missing in requests.\\n- Never include Markdown fences or commentary outside the JSON object.",
      "model": "gpt-4"
    },
    "verifier": {
      "systemPrompt": "You are a staff-level instructor verifying a worker agent's output for a demanding software task.\\n\\nResponsibilities:\\n1. Internalize the user's objectives and acceptance criteria.\\n2. Examine the worker's most recent JSON response for correctness, completeness, safety, and alignment with the user request.\\n3. Provide laser-focused guidance that unblocks or sharpens the worker's next move.\\n\\nResponse policy:\\n- Always return STRICT JSON with the shape:\\n{\\n  \\"verdict\\": \\"instruct\\" | \\"approve\\" | \\"fail\\",\\n  \\"critique\\": \\"succinct reasoning referencing concrete requirements\\",\\n  \\"instructions\\": \\"ordered guidance for the worker to follow next\\",\\n  \\"priority\\": number (1-5, where 1 is critical blocker)\\n}\\n- Use verdict \\"approve\\" ONLY when the worker's latest submission fully satisfies the user instructions.\\n- Use \\"fail\\" when the worker is off-track or violating constraints; clearly state blockers in critique.\\n- Otherwise respond with \\"instruct\\" and provide the next best set of actions in the instructions field.\\n- Keep critiques grounded in evidence and reference specific user needs or defects.\\n- Assume future turns depend solely on your guidance—be explicit about quality bars, edge cases, and verification steps.",
      "model": "gpt-4"
    }
  },
  "flow": {
    "bootstrap": {
      "key": "init",
      "role": "verifier",
      "agent": "verifier",
      "prompt": "User instructions:\\n{{user.task}}\\n\\nThe worker has not produced any output yet. Provide the first set of instructions that sets them up for success.",
      "stateUpdates": {
        "pendingInstructions": "{{current.parsed.instructions}}"
      },
      "next": "worker"
    },
    "round": {
      "maxRounds": 10,
      "steps": [
        {
          "key": "worker",
          "role": "worker",
          "agent": "worker",
          "prompt": "Primary task from the user:\\n{{user.task}}\\n\\nVerifier guidance for round #{{round}}:\\n{{state.pendingInstructions}}\\n\\nCritique from previous round (if any): {{state.latestCritique}}\\n\\nDeliver concrete progress that can be validated immediately."
        },
        {
          "key": "verifier",
          "role": "verifier",
          "agent": "verifier",
          "prompt": "User instructions:\\n{{user.task}}\\n\\nLatest worker JSON (round #{{round}}):\\n{{steps.worker.raw}}\\n\\nEvaluate the worker output, note gaps, and craft the next set of instructions.",
          "transitions": [
            {
              "condition": { "field": "parsed.verdict", "equals": "approve" },
              "outcome": "approved",
              "reason": "Approved by verifier"
            },
            {
              "condition": "always",
              "stateUpdates": {
                "pendingInstructions": "{{current.parsed.instructions}}",
                "latestCritique": "{{current.parsed.critique}}"
              }
            }
          ]
        }
      ],
      "defaultOutcome": {
        "outcome": "failed",
        "reason": "Max rounds reached"
      }
    }
  }
}`
  },
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
    name: 'worker',
    content: `---
description: A generic worker agent for executing instruction-based tasks.
mode: primary
permission:
  write: allow
  edit: allow
  bash: allow
  webfetch: allow
---
You are a worker agent. Execute the instructions provided to you.`
  },
  {
    name: 'verifier',
    content: `---
description: A verification agent for reviewing work.
mode: primary
permission:
  write: deny
  edit: deny
  bash: deny
  webfetch: allow
---
You are a verifier. detailed feedback and critique on the work provided.`
  },
  {
    name: 'comprehensive-workflow',
    content: `---
Description: A comprehensive architectural workflow.
mode: primary
permission:
  write: allow
  edit: allow
  bash: allow
  webfetch: allow
---
{
  "id": "comprehensive-workflow",
  "description": "A detailed workflow that goes from Architecture (PRD/ADR) -> Planning -> Phased Implementation -> Final Review.",
  "roles": {
    "architect": {
      "systemPrompt": "You are a Chief Software Architect. Your job is to analyze requests, gather context, and produce detailed technical documents (PRD, ADR) and a Phased Implementation Plan.\\n\\nYou MUST return a valid JSON object. Do not include markdown formatting or code blocks. Just the raw JSON string.\\n\\nOutput Format (JSON):\\n{\\n  \\"prd\\": \\"Product Requirements Document content...\\",\\n  \\"adr\\": \\"Architecture Decision Record content...\\",\\n  \\"phases\\": [ { \\"title\\": \\"Phase 1\\", \\"description\\": \\"Detailed steps...\\" } ]\\n}",
      "model": "gpt-4"
    },
    "tech-lead": {
      "systemPrompt": "You are the Technical Lead. You adhere strictly to the plan provided by the Architect. You manage the lifecycle of the implementation phases.\\n\\nInput Context:\\n- Plan: The array of phases.\\n- Current Phase Index.\\n- Last Verification Result (from the previous round).\\n\\nLogic:\\n1. If this is the start (Phase 0, no history), instructions = Start Phase 0.\\n2. If the previous round verification was APPROVED, increment the phase index and start the next phase.\\n3. If the previous round verification was REJECTED/INSTRUCT, stay on the current phase and provide instructions to fix the issues based on the critique.\\n4. If the new phase index exceeds the number of phases, mark as finished.\\n\\nYou MUST return a valid JSON object. Do not include markdown formatting or code blocks. Just the raw JSON string.\\n\\nOutput Format (JSON):\\n{\\n  \\"phaseIndex\\": number,\\n  \\"phaseTitle\\": string,\\n  \\"instructions\\": \\"Specific instructions for the worker...\\",\\n  \\"isFinished\\": boolean\\n}",
      "model": "gpt-4"
    },
    "worker": {
      "systemPrompt": "You are a Senior Full-Stack Engineer. You execute instructions precisely. You use TDD best practices.\\n\\nOutput Format (JSON):\\n{\\n  \\"status\\": \\"done\\",\\n  \\"work\\": \\"Description of work done\\"\\n}",
      "model": "gpt-4"
    },
    "verifier": {
      "systemPrompt": "You are the QA Lead. Review the work against the phase requirements.\\n\\nOutput Format (JSON):\\n{\\n  \\"verdict\\": \\"approve\\" | \\"instruct\\",\\n  \\"critique\\": \\"Feedback...\\",\\n  \\"instructions\\": \\"Fixes required...\\"\\n}",
      "model": "gpt-4"
    }
  },
  "state": {
    "initial": {
      "phaseIndex": "0",
      "lastVerifierOutcome": "{}"
    }
  },
  "flow": {
    "bootstrap": {
      "key": "architect-plan",
      "role": "architect",
      "agent": "plan",
      "prompt": "User Request: {{user.task}}\\n\\nAnalyze the context and produce a PRD, ADR, and Implementation Phases.",
      "stateUpdates": {
        "phases": "{{current.parsed.phases}}"
      },
      "next": "manager"
    },
    "round": {
      "maxRounds": 25,
      "steps": [
        {
          "key": "manager",
          "role": "tech-lead",
          "agent": "plan",
          "prompt": "Plan: {{bootstrap.parsed.phases}}\\n\\nCurrent Phase Index: {{state.phaseIndex}}\\nLast Verifier Outcome: {{state.lastVerifierOutcome}}\\n\\nDetermine next step.",
          "stateUpdates": {
            "phaseIndex": "{{current.parsed.phaseIndex}}"
          }
        },
        {
          "key": "worker",
          "role": "worker",
          "agent": "worker",
          "prompt": "Phase: {{steps.manager.parsed.phaseTitle}}\\nInstructions: {{steps.manager.parsed.instructions}}",
          "transitions": [
             {
               "condition": { "field": "@steps.manager.parsed.isFinished", "equals": true },
               "outcome": "done",
               "reason": "All phases complete"
             }
          ]
        },
        {
          "key": "verifier",
          "role": "verifier",
          "agent": "verifier",
          "prompt": "Review the work for Phase: {{steps.manager.parsed.phaseTitle}}.\\nWorker Output: {{steps.worker.raw}}",
          "stateUpdates": {
            "lastVerifierOutcome": "{{current.raw}}"
          }
        }
      ],
      "defaultOutcome": {
        "outcome": "failed",
        "reason": "Max rounds reached without completion"
      }
    }
  }
}`
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

  async listWorkflows(folder: string) {
    const workflowsDir = path.join(folder, '.opencode', 'workflows')
    try {
      await fs.mkdir(workflowsDir, { recursive: true })

      const files = await fs.readdir(workflowsDir)
      const workflows = []
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(workflowsDir, file), 'utf-8')
          try {
            workflows.push({ name: file.replace('.json', ''), content: JSON.parse(content) })
          } catch (e) {
            console.error(`Failed to parse workflow ${file}`, e)
          }
        }
      }
      return workflows
    } catch {
      return []
    }
  }

  async saveWorkflow(folder: string, name: string, content: any) {
    const workflowsDir = path.join(folder, '.opencode', 'workflows')
    await fs.mkdir(workflowsDir, { recursive: true })
    await fs.writeFile(path.join(workflowsDir, `${name}.json`), JSON.stringify(content, null, 2))
  }

  async deleteWorkflow(folder: string, name: string) {
    const filePath = path.join(folder, '.opencode', 'workflows', `${name}.json`)
    await fs.unlink(filePath)
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
