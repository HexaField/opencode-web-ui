import { z } from 'zod'
import { FolderQueryShape } from '../common/common.schema'

export const WorkflowConditionSchema = z.union([
  z.literal('always'),
  z.object({
    field: z.string(),
    equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
    notEquals: z.union([z.string(), z.number(), z.boolean()]).optional(),
    includes: z.string().optional(),
    caseSensitive: z.boolean().optional(),
    exists: z.boolean().optional()
  })
])

export type WorkflowCondition = z.infer<typeof WorkflowConditionSchema>

export const WorkflowTransitionSchema = z.object({
  condition: WorkflowConditionSchema,
  outcome: z.string().optional(),
  reason: z.string().optional(),
  nextStep: z.string().optional(),
  stateUpdates: z.record(z.string(), z.string()).optional()
})

export const WorkflowStepSchema = z.object({
  key: z.string(),
  role: z.string(),
  agent: z.string().optional(),
  prompt: z.union([z.string(), z.array(z.string())]),
  next: z.string().optional(),
  transitions: z.array(WorkflowTransitionSchema).optional(),
  exits: z.array(WorkflowTransitionSchema).optional(),
  stateUpdates: z.record(z.string(), z.string()).optional()
})

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>

export const WorkflowRoleSchema = z.object({
  systemPrompt: z.string(),
  model: z.string().optional(),
  parser: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional()
})

export const WorkflowFlowSchema = z.object({
  bootstrap: WorkflowStepSchema.optional(),
  round: z.object({
    maxRounds: z.number().default(10),
    steps: z.array(WorkflowStepSchema),
    defaultOutcome: z.object({
      outcome: z.string(),
      reason: z.string()
    })
  })
})

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  model: z.string().optional(),
  roles: z.record(z.string(), WorkflowRoleSchema),
  parsers: z.record(z.string(), z.any()).optional(), // Generic JSON schema
  state: z
    .object({
      initial: z.record(z.string(), z.string()).optional()
    })
    .optional(),
  flow: WorkflowFlowSchema,
  user: z.record(z.string(), z.any()).optional()
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const CreateWorkflowSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    name: z.string(),
    content: WorkflowDefinitionSchema
  })
})

export const RunWorkflowSchema = z.object({
  query: FolderQueryShape,
  body: z.object({
    inputs: z.record(z.string(), z.string())
  }),
  params: z.object({
    name: z.string()
  })
})
