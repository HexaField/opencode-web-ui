import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WorkflowEngine } from '../src/services/agents/engine'
import { WorkflowDefinition } from '../src/services/agents/workflow.definitions'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('Workflow Persistence & Resilience', () => {
  let tempDir: string
  let stateFile: string
  let mockExecutor: any

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-persist-test-'))
    stateFile = path.join(tempDir, 'state.json')

    mockExecutor = {
      execute: vi.fn()
    }
  })

  const workflow: WorkflowDefinition = {
    id: 'persist-test',
    description: 'Test Persistence',
    roles: { default: { systemPrompt: 'Sys' } },
    flow: {
      round: {
        maxRounds: 1,
        steps: [
          { key: 'step1', role: 'default', agent: 'default', prompt: 'Step 1' },
          { key: 'step2', role: 'default', agent: 'default', prompt: 'Step 2' },
          { key: 'step3', role: 'default', agent: 'default', prompt: 'Step 3' }
        ],
        defaultOutcome: { outcome: 'done', reason: 'finished' }
      }
    }
  }

  it('should save state to file after each step', async () => {
    const engine = new WorkflowEngine(mockExecutor)
    mockExecutor.execute.mockResolvedValue('ok')

    await engine.run(workflow, {}, stateFile)

    const content = await fs.readFile(stateFile, 'utf8')
    const state = JSON.parse(content)

    expect(state.run).toBeDefined()
    expect(state.steps.step1).toBeDefined()
    expect(state.steps.step2).toBeDefined()
    expect(state.steps.step3).toBeDefined()
  })

  it('should resume from the correct step if interrupted', async () => {
    // 1. Run partial workflow
    mockExecutor.execute.mockResolvedValueOnce('res1') // Step 1
    mockExecutor.execute.mockResolvedValueOnce('res2-crash') // Step 2

    // Create a special engine that "crashes" after step 1
    const crashingEngine = new WorkflowEngine(mockExecutor)
    // Monkey patch executeStep to crash
    const originalExec = (crashingEngine as any).executeStep.bind(crashingEngine)
    // let callCount = 0 // Removed unused var

    ;(crashingEngine as any).executeStep = async (step: any, scope: any, wf: any) => {
      const res = await originalExec(step, scope, wf)
      if (step.key === 'step2') {
        throw new Error('Simulated Crash during Step 2')
      }
      return res
    }

    try {
      await crashingEngine.run(workflow, {}, stateFile)
    } catch (e: any) {
      expect(e.message).toBe('Simulated Crash during Step 2')
    }

    // Check state file: should have step1, but maybe not step2 success
    const content = await fs.readFile(stateFile, 'utf8')
    const state = JSON.parse(content)
    expect(state.steps.step1).toBeDefined()
    expect(state.steps.step1.raw).toBe('res1')
    // Step 2 failed, so it shouldn't be in steps map relative to the loop?
    // Actually, executeStep returns result, then we assign to roundSteps.
    // If executeStep throws, we don't assign.
    expect(state.steps.step2).toBeUndefined()

    // 2. Resume with new engine
    mockExecutor.execute.mockClear()
    mockExecutor.execute.mockResolvedValueOnce('res2') // For step 2 (retry)
    mockExecutor.execute.mockResolvedValueOnce('res3') // For step 3

    const engine2 = new WorkflowEngine(mockExecutor)
    const result = await engine2.run(workflow, {}, stateFile)

    expect(result.outcome).toBe('done')

    // IMPORTANT Assertion:
    // Engine 2 starts. It loads usage.
    // checks steps. step1 exists.
    // persisted `currentStepKey` was 'step2' (saved after step1 finished).
    // So the loop starts at 'step2'.
    // Step 1 is SKIPPED entirely (not re-executed).
    // So expected calls: Step2, Step3.
    expect(mockExecutor.execute).toHaveBeenCalledTimes(2)
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(1, 'default', expect.stringContaining('Step 2'))
    expect(mockExecutor.execute).toHaveBeenNthCalledWith(2, 'default', expect.stringContaining('Step 3'))
  })

  it('should ignore corrupted state file and start fresh', async () => {
    await fs.writeFile(stateFile, '{ "invalid": json, }') // syntax error

    const engine = new WorkflowEngine(mockExecutor)
    mockExecutor.execute.mockResolvedValue('ok')

    const result = await engine.run(workflow, {}, stateFile)
    expect(result.outcome).toBe('done')
    expect(mockExecutor.execute).toHaveBeenCalledTimes(3)
  })
})
