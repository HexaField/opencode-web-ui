import { z } from 'zod'
import { FolderQueryShape } from '../common/common.schema'

export const CreateTaskSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    parent_id: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    dependencies: z.array(z.string()).optional(),
    kind: z.enum(['task', 'plan']).optional()
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
    dependencies: z.array(z.string()).optional(),
    kind: z.enum(['task', 'plan']).optional()
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

export type CreateTaskRequest = z.infer<typeof CreateTaskSchema>
export type UpdateTaskRequest = z.infer<typeof UpdateTaskSchema>
export type TaskTagRequest = z.infer<typeof TaskTagSchema>
export type DeleteTaskTagRequest = z.infer<typeof DeleteTaskTagSchema>
export type CreateTagRequest = z.infer<typeof CreateTagSchema>
