import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgenticPromptExecutor } from '../src/services/agents/agentic-executor'
import { ToolRegistry } from '../src/services/tools/tool-registry'
import { OpencodeClient } from '../src/opencode'

// Mocks
const mockClient = {
  session: {
    prompt: vi.fn(),
    messages: vi.fn(),
    status: vi.fn()
  }
} as unknown as OpencodeClient

const mockToolRegistry = {
  getAllDefinitions: vi.fn(),
  executeTool: vi.fn()
} as unknown as ToolRegistry

describe('AgenticPromptExecutor', () => {
  let executor: AgenticPromptExecutor
  const sessionId = 'test-session'

  beforeEach(() => {
    vi.clearAllMocks()
    executor = new AgenticPromptExecutor(mockClient, mockToolRegistry, sessionId)
  })

  it('should return text response when LLM returns text strictly', async () => {
    // Setup generic tool definitions
    vi.spyOn(mockToolRegistry, 'getAllDefinitions').mockReturnValue([])

    // Mock LLM response: Text only
    vi.spyOn(mockClient.session, 'prompt').mockResolvedValue({
      data: {
        parts: [{ type: 'text', text: 'Hello world' }]
      }
    } as any)

    const result = await executor.execute('agent-name', 'Hello')

    expect(result).toBe('Hello world')
    expect(mockClient.session.prompt).toHaveBeenCalledTimes(1)
  })

  it('should execute tool and loop when LLM calls a tool', async () => {
    vi.spyOn(mockToolRegistry, 'getAllDefinitions').mockReturnValue([
      { name: 'test_tool', description: 'desc', parameters: { type: 'object', properties: {} } }
    ])

    // First call: Tool Call
    vi.spyOn(mockClient.session, 'prompt')
      .mockResolvedValueOnce({
        data: {
          parts: [
            {
              type: 'tool_call',
              toolCall: { id: 'call_1', name: 'test_tool', arguments: '{}' }
            }
          ]
        }
      } as any)

      // Second call: Final text
      .mockResolvedValueOnce({
        data: {
          parts: [{ type: 'text', text: 'Task done' }]
        }
      } as any)

    vi.spyOn(mockToolRegistry, 'executeTool').mockResolvedValue('Tool Output')

    const result = await executor.execute('agent-name', 'Do task')

    expect(result).toBe('Task done')
    expect(mockToolRegistry.executeTool).toHaveBeenCalledWith('test_tool', {})
    expect(mockClient.session.prompt).toHaveBeenCalledTimes(2)
  })

  it('should stop after max steps', async () => {
    vi.spyOn(mockToolRegistry, 'getAllDefinitions').mockReturnValue([])

    // Infinite tool calls
    vi.spyOn(mockClient.session, 'prompt').mockResolvedValue({
      data: {
        parts: [
          {
            type: 'tool_call',
            toolCall: { id: 'call_loop', name: 'loop_tool', arguments: '{}' }
          }
        ]
      }
    } as any)
    vi.spyOn(mockToolRegistry, 'executeTool').mockResolvedValue('Loop')

    await expect(executor.execute('agent-name', 'Start loop')).rejects.toThrow('Max steps exceeded')
  })
})
