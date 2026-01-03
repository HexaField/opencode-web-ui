import { z } from 'zod'

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

export type GitStageRequest = z.infer<typeof GitStageSchema>
export type GitCommitRequest = z.infer<typeof GitCommitSchema>
export type GitPushPullRequest = z.infer<typeof GitPushPullSchema>
export type GitCheckoutRequest = z.infer<typeof GitCheckoutSchema>
export type GitBranchRequest = z.infer<typeof GitBranchSchema>
