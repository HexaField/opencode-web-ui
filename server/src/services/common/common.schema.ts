import { z } from 'zod'

export const FolderQueryShape = z.object({
  folder: z.string().min(1)
})

export const FolderBodyShape = z.object({
  folder: z.string().min(1)
})

export const FolderQuerySchema = z.object({
  query: FolderQueryShape
})

export const FolderBodySchema = z.object({
  body: FolderBodyShape
})
