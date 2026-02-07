import { describe, it, expect, vi } from 'vitest'
import { JobExecutor } from '../../src/services/scheduler/job.executor.js'
import * as cp from 'child_process'
import { Job } from '../../src/services/scheduler/scheduler.schema.js'
import { bus } from '../../src/services/event-bus.js'

// Mock child_process
vi.mock('child_process', () => {
  const spawnMock = vi.fn(() => ({
    on: vi.fn((event, cb) => {
      if (event === 'exit') cb(0)
      return this
    }),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() }
  }))

  return {
    spawn: spawnMock,
    default: { spawn: spawnMock }
  }
})

// Mock Bus
vi.mock('../../src/services/event-bus.js', () => ({
  bus: {
    emit: vi.fn()
  },
  Events: {
    SCHEDULE_TRIGGER: 'SCHEDULE_TRIGGER'
  }
}))

describe('Job Executor', () => {
  const executor = new JobExecutor()

  it('should execute agent_workflow job via event bus', async () => {
    const job: Job = {
      name: 'Agent Task',
      cron: '* * * * *',
      action: 'agent_workflow',
      payload: { prompt: 'Do something', output: 'logs' },
      enabled: true
    }

    await executor.execute(job)
    expect(bus.emit).toHaveBeenCalledWith(
      'SCHEDULE_TRIGGER',
      expect.objectContaining({
        task: 'Agent Task',
        prompt: 'Do something'
      })
    )
  })

  it('should execute script job via spawn', async () => {
    const job: Job = {
      name: 'Script Task',
      cron: '* * * * *',
      action: 'script',
      payload: { path: 'scripts/clean.ts' },
      enabled: true
    }

    await executor.execute(job)
    expect(cp.spawn).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['tsx', 'scripts/clean.ts']),
      expect.any(Object)
    )
  })
})
