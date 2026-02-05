export interface UserMessage {
  id: string
  userId: string
  content: string
  platform: string
  timestamp: number
  metadata?: any
}

export interface AgentResponse {
  userId: string
  content: string
  platform: string
  metadata?: any
}

export interface GatewayAdapter {
  name: string
  start(): Promise<void>
  stop(): Promise<void>
  onMessage(handler: (msg: UserMessage) => Promise<AgentResponse | void>): void
  sendMessage(userId: string, content: string): Promise<void>
}
