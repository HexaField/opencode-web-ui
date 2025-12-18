import type {
  Part,
  Message as SdkMessage,
  Session as SdkSession,
  ToolPart,
  ToolState,
  ToolStateCompleted
} from '@opencode-ai/sdk'

export type { Part as MessagePart, ToolPart, ToolState, ToolStateCompleted }

export type Message = {
  info: SdkMessage
  parts: Part[]
}

export type Session = SdkSession & {
  history: Message[]
}
