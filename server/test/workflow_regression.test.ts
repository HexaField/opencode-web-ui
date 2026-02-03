import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowEngine } from '../src/services/agents/engine'
import { WorkflowDefinition } from '../src/services/agents/workflow.definitions'

describe('Workflow Regression Tests', () => {
  let mockExecutor: any

  beforeEach(() => {
    mockExecutor = {
      execute: vi.fn()
    }
  })

  it('runs the review step at least once and retries if rejected', async () => {
    // Workflow: Design -> Implement -> Review
    const workflow: WorkflowDefinition = {
      id: 'regression-test',
      description: 'Test loop logic',
      roles: {
        plan: { systemPrompt: 'Planner' },
        build: { systemPrompt: 'Builder' }
      },
      flow: {
        round: {
          maxRounds: 5,
          steps: [
            {
              key: 'design',
              role: 'plan',
              agent: 'plan',
              prompt: 'Design {{user.task}}'
            },
            {
              key: 'implement',
              role: 'build',
              agent: 'build',
              prompt: 'Implement {{steps.design.raw}}',
              next: 'review',
              stateUpdates: {
                latestCritique: '{{state.latestCritique}}' // Persist critique if any
              }
            },
            {
              key: 'review',
              role: 'plan',
              agent: 'plan',
              prompt: 'Review {{steps.implement.raw}}. Critique: {{state.latestCritique}}',
              transitions: [
                {
                  condition: { field: 'raw', includes: 'APPROVED' },
                  outcome: 'approved'
                },
                {
                  condition: { field: 'raw', includes: 'REJECTED' },
                  nextStep: 'implement',
                  stateUpdates: {
                    latestCritique: '{{raw}}'
                  }
                }
              ]
            }
          ],
          defaultOutcome: {
            outcome: 'max-rounds',
            reason: 'Failed'
          }
        }
      }
    }

    const engine = new WorkflowEngine(mockExecutor)
    const inputs = { task: 'Build a calculator' }

    // Mock Responses
    mockExecutor.execute
      .mockResolvedValueOnce('Design Doc') // 1. Design
      .mockResolvedValueOnce('Code v1') // 2. Implement
      .mockResolvedValueOnce('REJECTED: Too slow') // 3. Review (Fail)
      .mockResolvedValueOnce('Code v2') // 4. Implement (Retry)
      .mockResolvedValueOnce('APPROVED') // 5. Review (Pass)

    const result = await engine.run(workflow, inputs)

    expect(mockExecutor.execute).toHaveBeenCalledTimes(5)
    expect(result.outcome).toBe('approved')

    // Check callback arguments to verify template resolution
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(
      1,
      'plan',
      expect.stringContaining('Design Build a calculator')
    )
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(2, 'build', expect.stringContaining('Implement Design Doc'))
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(3, 'plan', expect.stringContaining('Review Code v1'))

    // In the second implement call (loop), we don't have explicit feedback injection logic anymore
    // unless we programmed it in the prompt.
    // In our new definition above, we didn't add feedback to the prompt of 'implement',
    // but the 'review' step saved it to state, and we can check if it persists.
    // Actually engine doesn't auto-inject feedback. The prompt logic must use {{state.latestCritique}}.
    // Wait, the implementing step prompt is static: 'Implement {{steps.design.raw}}'.
    // If we want feedback, we must put it in the prompt.
  })
})
