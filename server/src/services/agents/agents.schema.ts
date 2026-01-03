import { z } from 'zod'
import { FolderQueryShape } from '../common/common.schema'

export const CreateAgentSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    name: z.string().min(1),
    content: z.string()
  })
})

export const DeleteAgentSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    name: z.string()
  })
})

export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>
export type DeleteAgentRequest = z.infer<typeof DeleteAgentSchema>
