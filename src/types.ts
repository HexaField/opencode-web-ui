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
  agent?: string
  model?: string
}

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  parent_id: string | null
  position: number
  created_at: number
  updated_at: number
  tags: Tag[]
  dependencies: string[] // array of task IDs
}
