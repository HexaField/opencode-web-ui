import { z } from 'zod'

export const JobPayloadSchema = z.object({
  prompt: z.string().optional(),
  output: z.string().optional(),
  path: z.string().optional(),
  args: z.array(z.string()).optional()
})

export const JobSchema = z.object({
  name: z.string(),
  cron: z.string(),
  action: z.enum(['agent_workflow', 'script']),
  payload: JobPayloadSchema,
  enabled: z.boolean().default(true)
})

export type Job = z.infer<typeof JobSchema>

export const ScheduleConfigSchema = z.array(JobSchema)
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>
