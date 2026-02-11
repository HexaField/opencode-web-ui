import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { PersonalAgent } from '../src/agent/PersonalAgent'
import { OpencodeManager } from '../src/opencode'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ToolRegistry } from '../src/services/tools/tool-registry'

// We need a longer timeout for E2E
describe('PersonalAgent E2E', () => {
  let tmpDir: string
  let manager: OpencodeManager
  let agent: PersonalAgent

  beforeAll(async () => {
    // Create temp workspace
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-e2e-'))
    console.log('E2E Workspace:', tmpDir)

    // Switch to tmp dir so process.cwd() matches (PersonalAgent uses cwd)
    // process.chdir(tmpDir) // Risky in parallel tests but ok for isolated suite
    // Actually PersonalAgent takes cwd from process.cwd() in start()
    // Let's spy on process.cwd if needed, or just change it.
    // Changing cwd is safest if we restore it.
  })

  afterAll(async () => {
    // Cleanup
    if (agent) agent.stop()
    // await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should run a full cycle and execute a tool', async () => {
    const originalCwd = process.cwd()
    try {
      process.chdir(tmpDir)

      // Mock Manager to return a controlled Client
      manager = new OpencodeManager()
      vi.spyOn(manager, 'connect').mockResolvedValue({
        session: {
          prompt: vi
            .fn()
            // First call: Tool Call
            .mockResolvedValueOnce({
              data: {
                parts: [
                  {
                    type: 'tool_call',
                    toolCall: {
                      id: 'call_1',
                      name: 'write_test_file',
                      arguments: JSON.stringify({ content: 'Hello E2E' })
                    }
                  }
                ]
              }
            })
            // Second call: Task Completed
            .mockResolvedValueOnce({
              data: {
                parts: [{ type: 'text', text: 'TASK_COMPLETED' }]
              }
            })
            // Fallback for safety
            .mockResolvedValue({
              data: { parts: [{ type: 'text', text: 'DONE' }] }
            }),
          messages: vi.fn(),
          status: vi.fn()
        }
      } as any)

      agent = new PersonalAgent(manager)

      await agent.start()

      // Wait for connection? start() awaits connection.

      // Register a test tool manually to avoid relying on complex packs loading effectively in test env
      // The FS tools usually come from packs. Let's register a simple one.
      ToolRegistry.getInstance().registerTool(
        {
          name: 'write_test_file',
          description: 'Writes a file.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string' }
            },
            required: ['content']
          }
        },
        async ({ content }: { content: string }) => {
          await fs.writeFile('e2e_test.txt', content)
          return 'File written'
        }
      )

      // Trigger Cycle
      const input = "Use the write_test_file tool to write 'Hello E2E' to e2e_test.txt"
      await agent.runCycle(input)

      // Verification
      const fileContent = await fs.readFile('e2e_test.txt', 'utf-8')
      expect(fileContent).toBe('Hello E2E')
    } finally {
      process.chdir(originalCwd)
    }
  }, 60000) // 60s timeout
})
