import { describe, it, expect, vi } from 'vitest'
import { WorkflowEngine } from '../src/services/agents/engine'
import { WorkflowDefinition } from '../src/services/agents/workflow.definitions'

const verifierWorkerWorkflow: WorkflowDefinition = {
  id: 'tdd-workflow',
  description: 'TDD Workflow',
  roles: {
    worker: { systemPrompt: 'Worker system prompt' },
    verifier: { systemPrompt: 'Verifier system prompt' }
  },
  flow: {
    bootstrap: {
      key: 'init',
      role: 'verifier',
      agent: 'verifier',
      prompt: 'Bootstrap',
      stateUpdates: {
        pendingInstructions: '{{current.parsed.instructions}}'
      },
      next: 'worker'
    },
    round: {
      maxRounds: 5,
      steps: [
        {
          key: 'worker',
          role: 'worker',
          agent: 'worker',
          prompt: 'Work on {{state.pendingInstructions}}. Critique: {{state.latestCritique}}'
        },
        {
          key: 'verifier',
          role: 'verifier',
          agent: 'verifier',
          prompt: 'Check {{steps.worker.raw}}',
          transitions: [
            {
              condition: { field: 'parsed.verdict', equals: 'approve' },
              outcome: 'approved',
              reason: 'Approved'
            },
            {
              condition: 'always',
              stateUpdates: {
                pendingInstructions: '{{current.parsed.instructions}}',
                latestCritique: '{{current.parsed.critique}}'
              }
            }
          ]
        }
      ],
      defaultOutcome: {
        outcome: 'failed',
        reason: 'Max rounds reached'
      }
    }
  }
}

const mockExecutor = {
  execute: vi.fn()
}

describe('Verifier-Worker Workflow execution', () => {
  it('runs successfully when approved first time (after bootstrap)', async () => {
    const engine = new WorkflowEngine(mockExecutor)
    mockExecutor.execute.mockReset()

    mockExecutor.execute
      // 1. Bootstrap (Verifier)
      .mockResolvedValueOnce(
        JSON.stringify({
          verdict: 'instruct',
          instructions: 'Do the thing'
        })
      )
      // 2. Worker (Round 1)
      .mockResolvedValueOnce(
        JSON.stringify({
          status: 'done',
          work: 'Did the thing'
        })
      )
      // 3. Verifier (Round 1) -> Approve
      .mockResolvedValueOnce(
        JSON.stringify({
          verdict: 'approve',
          instructions: 'Good job'
        })
      )

    const result = await engine.run(verifierWorkerWorkflow, { task: 'Build feature' })

    expect(result.outcome).toBe('approved')
    expect(mockExecutor.execute).toHaveBeenCalledTimes(3)

    // Verify Bootstrap call
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(1, 'verifier', expect.stringContaining('Bootstrap'))

    // Verify Worker call
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(2, 'worker', expect.stringContaining('Work on Do the thing'))
  })

  it('loops when instructed to fix', async () => {
    const engine = new WorkflowEngine(mockExecutor)
    mockExecutor.execute.mockReset()

    mockExecutor.execute
      // 1. Bootstrap
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'instruct', instructions: 'Initial task' }))
      // 2. Worker 1
      .mockResolvedValueOnce(JSON.stringify({ status: 'working', work: 'Bad work' }))
      // 3. Verifier 1 -> Fail/Instruct
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'instruct', instructions: 'Fix bugs' }))
      // 4. Worker 2
      .mockResolvedValueOnce(JSON.stringify({ status: 'done', work: 'Fixed work' }))
      // 5. Verifier 2 -> Approve
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'approve' }))

    const result = await engine.run(verifierWorkerWorkflow, { task: 'Complex task' })

    expect(result.outcome).toBe('approved')
    expect(mockExecutor.execute).toHaveBeenCalledTimes(5)

    // Verify Worker 2 received new instructions
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(4, 'worker', expect.stringContaining('Work on Fix bugs'))
  })

  it('persists critique and instructions across multiple failed rounds', async () => {
    const engine = new WorkflowEngine(mockExecutor)
    mockExecutor.execute.mockReset()

    mockExecutor.execute
      // 1. Bootstrap
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'instruct', instructions: 'Start' }))
      // 2. Worker 1
      .mockResolvedValueOnce(JSON.stringify({ status: 'working', work: 'Attempt 1' }))
      // 3. Verifier 1 -> Instruct
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'instruct', instructions: 'Fix 1', critique: 'Critique 1' }))
      // 4. Worker 2
      .mockResolvedValueOnce(JSON.stringify({ status: 'working', work: 'Attempt 2' }))
      // 5. Verifier 2 -> Instruct
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'instruct', instructions: 'Fix 2', critique: 'Critique 2' }))
      // 6. Worker 3
      .mockResolvedValueOnce(JSON.stringify({ status: 'done', work: 'Attempt 3' }))
      // 7. Verifier 3 -> Approve
      .mockResolvedValueOnce(JSON.stringify({ verdict: 'approve' }))

    const result = await engine.run(verifierWorkerWorkflow, { task: 'Hard task' })

    expect(result.outcome).toBe('approved')
    expect(mockExecutor.execute).toHaveBeenCalledTimes(7)

    // Check Round 2 Worker Prompt: Instructions="Fix 1", Critique="Critique 1"
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(
      4,
      'worker',
      expect.stringContaining('Work on Fix 1. Critique: Critique 1')
    )

    // Check Round 3 Worker Prompt: Instructions="Fix 2", Critique="Critique 2"
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(
      6,
      'worker',
      expect.stringContaining('Work on Fix 2. Critique: Critique 2')
    )
  })
})
