import { AGENTS_DASHBOARD_ROOT } from '../config.js'
import { OpencodeManager, type OpencodeClient } from '../opencode.js'
import { bus, Events } from '../services/event-bus.js'
import { ContextLoader } from '../services/memory/context_loader.js'
import { packLoader } from '../services/packs/pack-loader.js'
import { skillsService } from '../services/skills/skills.service.js'
import { toolRegistry } from '../services/tools/tool-registry.js'
import { WorkspaceRegistry } from '../services/workspaces/workspace.registry.js'
import { ProjectInitializer } from '../services/workspaces/project.initializer.js'
import '../services/security/security.hook.js'

import { AgenticPromptExecutor } from '../services/agents/agentic-executor.js'

export class PersonalAgent {
  private intervalId: NodeJS.Timeout | null = null
  private tickIntervalMs: number = 5000 // 5 seconds
  public systemPrompt: string = ''
  public status: 'idle' | 'thinking' = 'idle'

  private client: OpencodeClient | undefined
  private executor: AgenticPromptExecutor | undefined

  constructor(private manager: OpencodeManager) {
    this.setupListeners()
  }

  private setupListeners() {
    bus.on(Events.AGENT_START, () => {
      console.log('Event received: AGENT_START')
      this.refreshContext()
    })
    bus.on(Events.AGENT_STOP, () => {
      console.log('Event received: AGENT_STOP')
    })

    bus.on(Events.SCHEDULE_TRIGGER, async (payload: any) => {
      console.log('Event received: SCHEDULE_TRIGGER', payload)
      if (this.status === 'idle') {
        await this.runCycle(`System Event: It is time to ${payload.task}`)
      }
    })

    bus.on(Events.GATEWAY_MESSAGE, async (msg: any) => {
      console.log('Event received: GATEWAY_MESSAGE', msg)
      if (typeof msg === 'object' && msg.content) {
        await this.runCycle(msg.content)
      }
    })
  }

  public async refreshContext() {
    const principles = await ContextLoader.loadPrinciples()
    const memoryMd = await ContextLoader.loadMemoryMd()
    const journals = await ContextLoader.loadRecentJournals()

    const tools = toolRegistry.getAllDefinitions()
    const toolsPrompt = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')

    const skills = skillsService.listSkills()
    const skillsPrompt = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')

    const ws = await WorkspaceRegistry.getWorkspace(AGENTS_DASHBOARD_ROOT)
    let wsContext = ''
    if (ws) {
      wsContext = `
CURRENT PROJECT: ${ws.name}
PATH: ${ws.path}
Tags: ${ws.tags.join(', ')}
`
    }

    this.systemPrompt = `
${principles}

## YOUR IDENTITY (MEMORY.md)
${memoryMd}

## WORKSPACE CONTEXT
${wsContext}

## AVAILABLE TOOLS
${toolsPrompt}

## AVAILABLE SKILLS
Use the 'skill' tool to load the instructions for any of these skills:
${skillsPrompt}

## RECENT JOURNALS (Context)
${journals}
`

    console.log('Agent Context Refreshed')
  }

  public async start() {
    console.log('Agent Runtime Started')
    if (this.manager) console.log('Manager connected')

    await ProjectInitializer.ensureInitialized(AGENTS_DASHBOARD_ROOT)
    await WorkspaceRegistry.registerWorkspace(AGENTS_DASHBOARD_ROOT)

    // Initialize Skills
    await skillsService.initialize()

    // Register Skill Loader
    const loader = skillsService.getLoaderTool()
    const { execute: loadExec, ...loadDef } = loader
    toolRegistry.registerTool(loadDef as any, loadExec)

    // Register Skill Creator
    const creator = skillsService.getCreatorTool()
    const { execute: createExec, ...createDef } = creator
    toolRegistry.registerTool(createDef as any, createExec)

    // Connect Opencode Client
    try {
      this.client = await this.manager.connect(AGENTS_DASHBOARD_ROOT)
      console.log('[PersonalAgent] Connected to Opencode Client')

      this.executor = new AgenticPromptExecutor(this.client, toolRegistry, 'personal-agent-session')
    } catch (err) {
      console.error('[PersonalAgent] Failed to connect Opencode Client:', err)
    }

    await packLoader.loadPacks()

    bus.emit(Events.AGENT_START)

    this.intervalId = setInterval(() => {
      this.tick()
    }, this.tickIntervalMs)
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    bus.emit(Events.AGENT_STOP)
    console.log('Agent Runtime Stopped')
  }

  private tick() {
    bus.emit(Events.AGENT_TICK)
  }

  public async runForSession(sessionId: string, input: string) {
    if (this.status === 'thinking') {
      console.warn('[PersonalAgent] Already thinking, task queued (not really)')
      // TODO: Queue
    }

    this.status = 'thinking'
    try {
      if (!this.client) throw new Error('Client not connected')
      await this.refreshContext()

      // Create a transient executor for this session
      const executor = new AgenticPromptExecutor(this.client, toolRegistry, sessionId)

      console.log(`[PersonalAgent] Running session task for ${sessionId}`)
      await executor.execute('personal-agent', input)
    } catch (err) {
      console.error('[PersonalAgent] Session Run Error:', err)
      throw err
    } finally {
      this.status = 'idle'
    }
  }

  public async runCycle(input: string) {
    if (this.status === 'thinking') {
      console.warn('[PersonalAgent] Already thinking, queuing not implemented')
      return
    }

    this.status = 'thinking'
    try {
      console.log('[PersonalAgent] Starting Cycle:', input)
      await this.refreshContext()

      if (!this.executor) throw new Error('Executor not initialized')

      const result = await this.executor.execute('personal-agent', input)

      console.log('[PersonalAgent] Cycle Complete:', result)
    } catch (err) {
      console.error('[PersonalAgent] Cycle Error:', err)
    } finally {
      this.status = 'idle'
    }
  }
}
