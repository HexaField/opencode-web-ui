import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ToolRegistry } from '../../src/services/tools/tool-registry.js'
import { ToolDefinition } from '../../src/types/packs.js'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    // Access the private instance to reset it or just rely on it being singleton.
    // Since it's a singleton, state persists. Ideally we'd have a .reset() method for testing,
    // but for now we can rely on using unique names or accepting the state.
    registry = ToolRegistry.getInstance()
  })

  it('should be a singleton', () => {
    const r2 = ToolRegistry.getInstance()
    expect(r2).toBe(registry)
  })

  it('should register and retrieve a tool', () => {
    const toolDef: ToolDefinition = {
      name: 'test_tool_' + Date.now(),
      description: 'A test tool',
      parameters: { type: 'object', properties: {} }
    }
    const impl = vi.fn().mockReturnValue('success')

    registry.registerTool(toolDef, impl)

    expect(registry.getToolDefinition(toolDef.name)).toBe(toolDef)
    expect(registry.getImplementation(toolDef.name)).toBe(impl)
  })

  it('should execute a tool', async () => {
    const name = 'exec_tool_' + Date.now()
    const impl = vi.fn().mockResolvedValue('result')

    registry.registerTool(
      {
        name,
        description: 'desc',
        parameters: { type: 'object', properties: {} }
      },
      impl
    )

    const result = await registry.executeTool(name, { foo: 'bar' })
    expect(result).toBe('result')
    expect(impl).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('should throw if tool not found', async () => {
    await expect(registry.executeTool('non_existent_tool', {})).rejects.toThrow('Tool not found')
  })
})
