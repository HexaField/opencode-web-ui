import { describe, it, expect, vi } from 'vitest'
import { schedulerService } from '../../src/services/scheduler/scheduler.service.js'
import * as cron from 'node-cron'

vi.mock('node-cron', () => {
  return {
    schedule: vi.fn(),
    ScheduledTask: class {
      stop() {}
    }
  }
})

// Mock JobExecutor
vi.mock('../../src/services/scheduler/job.executor.js', () => {
  return {
    JobExecutor: class {
      execute = vi.fn().mockResolvedValue(undefined)
    }
  }
})

describe('Scheduler Service', () => {
  it('initializes correctly', () => {
    expect(schedulerService).toBeDefined()
  })

  it('registers a job via manual registration', () => {
    const jobs: any[] = [{ cron: '0 0 * * *', name: 'Test Task', action: 'agent_workflow', enabled: true }]
    const scheduleSpy = vi.mocked(cron.schedule)

    const service = schedulerService as any
    service.registerJobs(jobs)

    expect(scheduleSpy).toHaveBeenCalledWith('0 0 * * *', expect.any(Function))
  })

  it('triggers executor when job fires', () => {
    const jobs: any[] = [{ cron: '0 0 * * *', name: 'Test Task', action: 'agent_workflow', enabled: true }]
    const scheduleSpy = vi.mocked(cron.schedule)

    scheduleSpy.mockImplementation((_expr, func) => {
      // @ts-ignore
      func()
      return { stop: () => {} } as any
    })

    const service = schedulerService as any
    // Reset executor mock - access the instance on the service
    // Does service.executor exist? yes.
    // If we want to spy on it, we might need to grab it from the instance

    // Create spy on the actual instance method
    const executeSpy = vi.spyOn(service.executor, 'execute')

    service.registerJobs(jobs)

    expect(executeSpy).toHaveBeenCalled()
  })
})
