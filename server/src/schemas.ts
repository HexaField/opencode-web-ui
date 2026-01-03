import { z } from 'zod'

// Common shapes
const FolderQueryShape = z.object({
  folder: z.string().min(1)
})

const FolderBodyShape = z.object({
  folder: z.string().min(1)
})

// Exported Schemas (Request objects)

export const FolderQuerySchema = z.object({
  query: FolderQueryShape
})

export const FolderBodySchema = z.object({
  body: FolderBodyShape
})

// Connect
export const ConnectSchema = z.object({
  body: FolderBodyShape
})

// Sessions
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
    agent: z.string().optional()
  })
})

// Agents
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

// Git
export const GitStageSchema = z.object({
  body: z.object({
    folder: z.string(),
    files: z.array(z.string())
  })
})

export const GitCommitSchema = z.object({
  body: z.object({
    folder: z.string(),
    message: z.string().min(1)
  })
})

export const GitPushPullSchema = z.object({
  body: z.object({
    folder: z.string(),
    remote: z.string().optional(),
    branch: z.string().optional()
  })
})

export const GitCheckoutSchema = z.object({
  body: z.object({
    folder: z.string(),
    branch: z.string()
  })
})

export const GitBranchSchema = z.object({
  body: z.object({
    folder: z.string(),
    branch: z.string(),
    from: z.string().optional()
  })
})

// Files
export const FileReadSchema = z.object({
  query: z.object({
    folder: z.string(),
    path: z.string()
  })
})

export const FSListSchema = z.object({
  query: z.object({
    path: z.string().optional()
  })
})

export const FSReadSchema = z.object({
  query: z.object({
    path: z.string()
  })
})

export const FSWriteSchema = z.object({
  body: z.object({
    path: z.string(),
    content: z.string()
  })
})

export const FSDeleteSchema = z.object({
  body: z.object({
    path: z.string()
  })
})

// Tasks
export const CreateTaskSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    parent_id: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    dependencies: z.array(z.string()).optional()
  })
})

export const UpdateTaskSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    parent_id: z.string().optional(),
    position: z.number().optional(),
    dependencies: z.array(z.string()).optional()
  })
})

export const TaskTagSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    tag_id: z.string()
  })
})

export const DeleteTaskTagSchema = z.object({
  query: FolderQueryShape,
  params: z.object({
    id: z.string(),
    tagId: z.string()
  })
})

export const CreateTagSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    name: z.string().min(1),
    color: z.string()
  })
})

// Export types
export type ConnectRequest = z.infer<typeof ConnectSchema>
export type CreateSessionRequest = z.infer<typeof CreateSessionSchema>
export type GetSessionRequest = z.infer<typeof GetSessionSchema>
export type UpdateSessionRequest = z.infer<typeof UpdateSessionSchema>
export type SessionPromptRequest = z.infer<typeof SessionPromptSchema>
export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>
export type DeleteAgentRequest = z.infer<typeof DeleteAgentSchema>
export type GitStageRequest = z.infer<typeof GitStageSchema>
export type GitCommitRequest = z.infer<typeof GitCommitSchema>
export type GitPushPullRequest = z.infer<typeof GitPushPullSchema>
export type GitCheckoutRequest = z.infer<typeof GitCheckoutSchema>
export type GitBranchRequest = z.infer<typeof GitBranchSchema>
export type FileReadRequest = z.infer<typeof FileReadSchema>
export type FSListRequest = z.infer<typeof FSListSchema>
export type FSReadRequest = z.infer<typeof FSReadSchema>
export type FSWriteRequest = z.infer<typeof FSWriteSchema>
export type FSDeleteRequest = z.infer<typeof FSDeleteSchema>
export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>
export type TaskTagRequest = z.infer<typeof TaskTagSchema>
export type DeleteTaskTagRequest = z.infer<typeof DeleteTaskTagSchema>
export type CreateTagRequest = z.infer<typeof CreateTagSchema>
