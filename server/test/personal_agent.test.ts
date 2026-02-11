import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PersonalAgent } from '../src/agent/PersonalAgent.js'
import { bus, Events } from '../src/services/event-bus.js'
import { OpencodeManager } from '../src/opencode.js'

vi.mock('../src/opencode.js')

// Mock dependencies to prevent real FS/Timer usage during tests
vi.mock('../src/services/packs/pack-loader.js', () => ({
  packLoader: {
    loadPacks: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../src/services/workspaces/project.initializer.js', () => ({
  ProjectInitializer: {
    ensureInitialized: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../src/services/workspaces/workspace.registry.js', () => ({
  WorkspaceRegistry: {
    registerWorkspace: vi.fn().mockResolvedValue(undefined),
    getWorkspace: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../src/services/memory/context_loader.js', () => ({
  ContextLoader: {
    loadPrinciples: vi.fn().mockResolvedValue('Mock Principles'),
    loadMemoryMd: vi.fn().mockResolvedValue('Mock Memory'),
    loadRecentJournals: vi.fn().mockResolvedValue('Mock Journals')
  }
}))

vi.mock('../src/services/tools/tool-registry.js', () => ({
  toolRegistry: {
    getAllDefinitions: vi.fn().mockReturnValue([]),
    registerTool: vi.fn()
  }
}))

vi.mock('../src/services/skills/skills.service.js', () => ({
  skillsService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getLoaderTool: vi.fn().mockReturnValue({ name: 'skill', execute: vi.fn() }),
    getCreatorTool: vi.fn().mockReturnValue({ name: 'create_skill', execute: vi.fn() }),
    listSkills: vi.fn().mockReturnValue([])
  }
}))

describe('PersonalAgent', () => {
  let agent: PersonalAgent
  let mockManager: OpencodeManager

  beforeEach(() => {
    vi.useFakeTimers()
    mockManager = new OpencodeManager() as any
    agent = new PersonalAgent(mockManager)
  })

  afterEach(() => {
    agent.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should start and emit AGENT_START', async () => {
    const spy = vi.spyOn(bus, 'emit')
    await agent.start()
    expect(spy).toHaveBeenCalledWith(Events.AGENT_START)
  })

  it('should emit AGENT_TICK on interval', async () => {
    const spy = vi.spyOn(bus, 'emit')
    await agent.start()

    // Fast forward time
    vi.advanceTimersByTime(5100)
    expect(spy).toHaveBeenCalledWith(Events.AGENT_TICK)

    vi.advanceTimersByTime(5000)
    expect(spy).toHaveBeenCalledWith(Events.AGENT_TICK)
  })

  it('should stop and emit AGENT_STOP', async () => {
    const spy = vi.spyOn(bus, 'emit')
    await agent.start()
    agent.stop()
    expect(spy).toHaveBeenCalledWith(Events.AGENT_STOP)
  })
})
