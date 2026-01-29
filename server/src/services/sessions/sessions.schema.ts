import { z } from 'zod'
import { FolderQueryShape } from '../common/common.schema'

export const CreateSessionSchema = z.object({
  query: FolderQueryShape,
  body: z
    .object({
      agent: z.string().optional(),
      model: z.string().optional()
    })
    .passthrough() // Allow other session data
})

export const GetSessionSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  })
})

export const UpdateSessionSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    agent: z.string().optional(),
    model: z.string().optional(),
    title: z.string().optional()
  })
})

export const SessionPromptSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    parts: z.array(z.any()), // TODO: Define stricter types for parts
    model: z.string().optional(),
    agent: z.string().optional(),
    messageID: z.string().optional()
  })
})

export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>
export type GetSessionRequest = z.infer<typeof GetSessionSchema>
export type UpdateSessionRequest = z.infer<typeof UpdateSessionSchema>
export type SessionPromptRequest = z.infer<typeof SessionPromptSchema>

export const BranchSessionSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    parts: z.array(z.any()),
    model: z.string().optional(),
    agent: z.string().optional(),
    messageID: z.string() // Required for branching (the split point)
  })
})

export const RevertSessionSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    messageID: z.string().optional(),
    partID: z.string().optional()
  })
})

export const UnrevertSessionSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  })
})
