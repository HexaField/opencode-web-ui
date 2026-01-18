import { z } from 'zod'

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

export const FSSearchSchema = z.object({
  body: z.object({
    query: z.string(),
    folder: z.string(),
    isRegex: z.boolean().optional(),
    isCaseSensitive: z.boolean().optional(),
    matchWholeWord: z.boolean().optional(),
    useGitIgnore: z.boolean().optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional()
  })
})

export type FileReadRequest = z.infer<typeof FileReadSchema>
export type FSListRequest = z.infer<typeof FSListSchema>
export type FSReadRequest = z.infer<typeof FSReadSchema>
export type FSWriteRequest = z.infer<typeof FSWriteSchema>
export type FSDeleteRequest = z.infer<typeof FSDeleteSchema>
export type FSSearchRequest = z.infer<typeof FSSearchSchema>
