import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersonalAgent } from '../src/agent/PersonalAgent.js'
import { WorkspaceRegistry } from '../src/services/workspaces/workspace.registry.js'
import { learningService } from '../src/services/memory/learning.service.js'
import { toolRegistry } from '../src/services/tools/tool-registry.js'

vi.mock('../src/services/workspaces/workspace.registry.js')
vi.mock('../src/services/memory/learning.service.js')
vi.mock('../src/services/tools/tool-registry.js')
vi.mock('../src/services/event-bus.js')
vi.mock('../src/services/packs/pack-loader.js')

describe('PersonalAgent Context', () => {
  let agent: PersonalAgent
  let mockManager: any

  beforeEach(() => {
    vi.resetAllMocks()

    mockManager = {
      cwd: '/tmp/project' // Assume manager exposes cwd
    }

    agent = new PersonalAgent(mockManager)

    vi.mocked(learningService.getLearnedLessons).mockResolvedValue('No lessons')
    vi.mocked(toolRegistry.getAllDefinitions).mockReturnValue([])
  })

  it('should inject workspace context into system prompt', async () => {
    // Setup registry mock
    // @ts-expect-error
    vi.mocked(WorkspaceRegistry.load).mockResolvedValue({
      // Need to mock load or public method?
      // Actually implementation calls getWorkspace or similar?
      // Let's assume implementation uses getWorkspaces() and finds match?
      // Or better, adds getWorkspace(path)
      workspaces: [{ path: '/tmp/project', name: 'MyProject', lastOpened: '', tags: ['react'] }]
    } as any)

    // Wait, WorkspaceRegistry methods are static.
    // I should add getWorkspace(path) to Registry or let agent search.
    // Registry.getWorkspace(path) is cleaner.

    // Let's update implementation plan to add getWorkspace(path).

    /*
           Simulate:
           agent.refreshContext() uses WorkspaceRegistry.getWorkspace(...)
        */

    // For now, let's mock the behavior assuming I'll implement getWorkspace in Registry.
    vi.spyOn(WorkspaceRegistry, 'getWorkspace').mockResolvedValue({
      path: '/tmp/project',
      name: 'MyProject',
      lastOpened: 'now', // Corrected date string for test
      tags: ['frontend']
    } as any)

    await agent.refreshContext()

    expect(agent.systemPrompt).toContain('CURRENT PROJECT: MyProject')
    expect(agent.systemPrompt).toContain('Tags: frontend')
  })
})
