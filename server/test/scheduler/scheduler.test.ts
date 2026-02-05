import { describe, it, expect, vi } from 'vitest'
import { schedulerService } from '../../src/services/scheduler/scheduler.service.js'
import { bus, Events } from '../../src/services/event-bus.js'
import * as cron from 'node-cron'

vi.mock('node-cron', () => {
  return {
    schedule: vi.fn(),
    ScheduledTask: class {}
  }
})

describe('Scheduler Service', () => {
  it('initializes correctly', () => {
    expect(schedulerService).toBeDefined()
    expect(bus).toBeDefined()
    expect(typeof bus.on).toBe('function')
  })

  it('registers a job via manual registration', () => {
    const jobs = [{ cron: '0 0 * * *', task: 'Test Task', enabled: true }]
    const scheduleSpy = vi.mocked(cron.schedule)

    const service = schedulerService as any
    service.registerJobs(jobs)

    expect(scheduleSpy).toHaveBeenCalledWith('0 0 * * *', expect.any(Function))
  })

  it('emits event when job triggers', () => {
    const jobs = [{ cron: '0 0 * * *', task: 'Test Task', enabled: true }]
    const scheduleSpy = vi.mocked(cron.schedule)

    scheduleSpy.mockImplementation((expr, func) => {
      // @ts-ignore
      func()
      return {} as any
    })

    const listener = vi.fn()
    bus.on(Events.SCHEDULE_TRIGGER, listener)

    const service = schedulerService as any
    service.registerJobs(jobs)

    expect(listener).toHaveBeenCalledWith({ task: 'Test Task' })
  })
})
