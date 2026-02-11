import { OpencodeClient } from '../../opencode.js'
import { ToolRegistry } from '../tools/tool-registry.js'
import { PromptExecutor } from './engine.js'
import { unwrap } from '../../utils.js'

export class AgenticPromptExecutor implements PromptExecutor {
  private MAX_STEPS = 10

  constructor(
    private client: OpencodeClient,
    private toolRegistry: ToolRegistry,
    private sessionId: string
  ) {}

  async execute(agentName: string, prompt: string): Promise<string> {
    let currentPrompt = prompt
    let previousToolCallId: string | undefined

    for (let step = 0; step < this.MAX_STEPS; step++) {
      // Construct prompt payload
      const parts: any[] = []

      // If this is the follow-up to a tool call, we need to provide the result
      if (previousToolCallId) {
        // Logic handled by the fact that the result is appended to history by the client?
        // Actually, Opencode SDK usually handles history state on the server side for 'prompt'.
        // BUT, we need to send the tool output as a "user" or "tool" message?
        // Checking SDK Usage: client.session.prompt appends a NEW message.

        // If we are in a loop, we are SENDING the tool output.
        // The PREVIOUS response (Tool Call) is already in history (assistant).
        // NOW we send the tool result.
        parts.push({
          type: 'tool_result',
          toolResult: {
            id: previousToolCallId,
            result: currentPrompt // In the loop, currentPrompt becomes the tool output
          }
        })
        previousToolCallId = undefined
      } else {
        // Normal user prompt
        parts.push({ type: 'text', text: currentPrompt })
      }

      const res = await this.client.session.prompt({
        path: { id: this.sessionId },
        body: {
          parts,
          agent: agentName,
          // @ts-ignore - Internal flag to prevent recursive agent execution
          skipAgentRun: true
        }
      })

      if ((res as any).error) {
        throw new Error(`LLM Error: ${(res as any).error}`)
      }

      const responseData = unwrap(res) as any
      // Extract the last message or parts from response
      // `prompt` usually returns the NEW message created.

      const responseParts = responseData.parts || []

      // CHeck for tool calls
      const toolCalls = responseParts.filter((p: any) => p.type === 'tool_call')

      if (toolCalls.length > 0) {
        // Execute Tool
        // We only support sequential tool execution for simplicity in this V1
        const call = toolCalls[0].toolCall
        console.log(`[AgenticExecutor] Tool Call: ${call.name}`)

        try {
          const args = JSON.parse(call.arguments)
          const output = await this.toolRegistry.executeTool(call.name, args)

          // Set up for next loop
          currentPrompt = JSON.stringify(output)
          previousToolCallId = call.id

          continue // Loop back to send result
        } catch (err) {
          currentPrompt = `Error executing tool ${call.name}: ${err}`
          previousToolCallId = call.id
          continue
        }
      }

      // Check for text
      const textParts = responseParts.filter((p: any) => p.type === 'text')
      if (textParts.length > 0) {
        return textParts.map((p: any) => p.text).join('\n')
      }

      // If neither?
      return ''
    }

    throw new Error('Max steps exceeded')
  }

  /*
  private convertTools(tools: ToolDefinition[]): any[] {
    // Convert standard ToolDefinition to LLM compatible tools
    // This matches OpenAI format usually
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }
  */
}
