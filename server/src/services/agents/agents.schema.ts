import { z } from 'zod'
import { FolderQueryShape } from '../common/common.schema'

export const AgentPermissionsSchema = z.object({
  write: z.string(),
  edit: z.string(),
  bash: z.string(),
  webfetch: z.string()
})

export const AgentConfigSchema = z.object({
  description: z.string(),
  mode: z.enum(['primary', 'subagent']),
  model: z.string(),
  permission: AgentPermissionsSchema
})

export const CreateAgentSchema = z.object({
  query: FolderQueryShape,
  body: z
    .object({
      name: z.string().min(1),
      content: z.string().optional(),
      config: AgentConfigSchema.optional(),
      prompt: z.string().optional()
    })
    .refine((data) => data.content || (data.config && typeof data.prompt === 'string'), {
      message: "Either 'content' or 'config' + 'prompt' must be provided"
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
