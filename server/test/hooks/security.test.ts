import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toolRegistry } from '../../src/services/tools/tool-registry.js'
import '../../src/services/security/security.hook.js' // Register hooks

describe('Security System (Hooks)', () => {
  
  beforeEach(() => {
    // Register a mock implementation of shell_exec
    // The security hook listens for 'shell_exec' specifically
    toolRegistry.registerTool(
      {
        name: 'shell_exec',
        description: 'Execute shell command',
        parameters: { type: 'object', properties: {} }
      },
      async (args: any) => {
        return `Executed: ${args.command}`
      }
    )
  })

  it('allows safe commands', async () => {
    const result = await toolRegistry.executeTool('shell_exec', { command: 'ls -la' })
    expect(result).toBe('Executed: ls -la')
  })

  it('blocks dangerous commands (rm -rf /)', async () => {
    await expect(async () => {
      await toolRegistry.executeTool('shell_exec', { command: 'rm -rf /' })
    }).rejects.toThrow(/Security Policy/)
  })

  it('blocks fork bombs', async () => {
      await expect(async () => {
        await toolRegistry.executeTool('shell_exec', { command: ':(){ :|:& };:' })
      }).rejects.toThrow(/Security Policy/)
  })
  
  it('blocks mkfs', async () => {
      await expect(async () => {
        await toolRegistry.executeTool('shell_exec', { command: 'mkfs.ext4 /dev/sda' })
      }).rejects.toThrow(/Security Policy/)
  })

})
