import { ToolDefinition } from '../../types/packs.js'
import { bus, Events } from '../event-bus.js'

export class ToolRegistry {
  private static instance: ToolRegistry
  private tools: Map<string, ToolDefinition> = new Map()
  private implementations: Map<string, Function> = new Map()

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry()
    }
    return ToolRegistry.instance
  }

  registerTool(def: ToolDefinition, impl: Function) {
    if (this.tools.has(def.name)) {
      console.warn(`[ToolRegistry] Overwriting tool: ${def.name}`)
    }
    this.tools.set(def.name, def)
    this.implementations.set(def.name, impl)
  }

  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getImplementation(name: string): Function | undefined {
    return this.implementations.get(name)
  }

  async executeTool(name: string, args: any): Promise<any> {
    const impl = this.implementations.get(name)
    if (!impl) {
      throw new Error(`Tool not found: ${name}`)
    }

    try {
      // Security Check: Hooks can throw to abort execution
      await bus.emitAsync(Events.TOOL_PRE_EXECUTE, { name, args })

      const result = await impl(args)

      // Post-execution hooks (Logging, Learning)
      await bus.emitAsync(Events.TOOL_POST_EXECUTE, { name, args, result })
      
      return result
    } catch (error) {
      throw error
    }
  }
}

export const toolRegistry = ToolRegistry.getInstance()
