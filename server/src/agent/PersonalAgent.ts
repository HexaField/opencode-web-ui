import { OpencodeManager } from '../opencode.js'
import { bus, Events } from '../services/event-bus.js'
import { learningService } from '../services/memory/learning.service.js'
import { packLoader } from '../services/packs/pack-loader.js'
import { toolRegistry } from '../services/tools/tool-registry.js'
import { WorkspaceRegistry } from '../services/workspaces/workspace.registry.js'
import { ProjectInitializer } from '../services/workspaces/project.initializer.js'
// Ensure security hooks are loaded
import '../services/security/security.hook.js'

export class PersonalAgent {
  private intervalId: NodeJS.Timeout | null = null
  private tickIntervalMs: number = 5000 // 5 seconds
  // System prompt is stored here for future use by the agent execution loop
  public systemPrompt: string = ''
  public status: 'idle' | 'thinking' = 'idle'

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

    // Plan 5: Gateway & Scheduler Handlers
    bus.on(Events.SCHEDULE_TRIGGER, (payload: any) => {
      console.log('Event received: SCHEDULE_TRIGGER', payload)
      // TODO: Feed this into the LLM context loop
      // input = `System Event: It is time to ${payload.task}`
    })

    bus.on(Events.GATEWAY_MESSAGE, (msg: any) => {
      console.log('Event received: GATEWAY_MESSAGE', msg)
      // TODO: Feed this into the LLM context loop
    })
  }

  public async refreshContext() {
    // 1. Load Lessons
    const lessons = await learningService.getLearnedLessons()

    // 2. Load Tools
    const tools = toolRegistry.getAllDefinitions()
    const toolsPrompt = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')

    // 3. Load Workspace Context
    const ws = await WorkspaceRegistry.getWorkspace(process.cwd())
    let wsContext = ''
    if (ws) {
      wsContext = `
CURRENT PROJECT: ${ws.name}
PATH: ${ws.path}
Tags: ${ws.tags.join(', ')}
`
    }

    this.systemPrompt = `You are a personal OS agent.
${wsContext}
AVAILABLE TOOLS:
${toolsPrompt}

LESSONS LEARNED:
${lessons}`

    console.log('Agent Context Refreshed')
  }

  public async start() {
    console.log('Agent Runtime Started')
    // Manager is ready
    if (this.manager) console.log('Manager connected')

    // Initialize/Analyze Project if needed
    await ProjectInitializer.ensureInitialized(process.cwd())

    // Register Current Workspace
    await WorkspaceRegistry.registerWorkspace(process.cwd())

    // Load Packs
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
    // console.log('Agent Tick')
    bus.emit(Events.AGENT_TICK)
    // Future logic goes here
  }
}
