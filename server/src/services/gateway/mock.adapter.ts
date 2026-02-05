import { GatewayAdapter, UserMessage, AgentResponse } from './types.js'
import { v4 as uuidv4 } from 'uuid'

export class MockAdapter implements GatewayAdapter {
  name = 'mock'
  private handler: ((msg: UserMessage) => Promise<AgentResponse | void>) | null = null

  async start(): Promise<void> {
    console.log('[MockAdapter] Started')
  }

  async stop(): Promise<void> {
    console.log('[MockAdapter] Stopped')
  }

  onMessage(handler: (msg: UserMessage) => Promise<AgentResponse | void>): void {
    this.handler = handler
  }

  async sendMessage(userId: string, content: string): Promise<void> {
    console.log(`[MockAdapter] OUTBOUND to ${userId}: ${content}`)
  }

  // Test helper to simulate incoming
  async simulateIncoming(userId: string, content: string) {
    if (this.handler) {
      await this.handler({
        id: uuidv4(),
        userId,
        content,
        platform: 'mock',
        timestamp: Date.now()
      })
    }
  }
}
