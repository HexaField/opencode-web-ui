import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { AppPaths } from '../../src/config.js'
import { SchedulerService } from '../../src/services/scheduler/scheduler.service.js'
import { ScheduleConfigSchema } from '../../src/services/scheduler/scheduler.schema.js'

describe('Scheduler Job Loading', () => {
  const jobsPath = path.join(AppPaths.config, 'jobs.json')

  beforeEach(() => {
    // Reset singleton if possible, or just create new instance if exposed
    // Since it's a singleton, we might need to mock fs before getInstance is called or add a reload method.
    if (!fs.existsSync(AppPaths.config)) {
      fs.mkdirSync(AppPaths.config, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(jobsPath)) {
      fs.unlinkSync(jobsPath)
    }
    vi.restoreAllMocks()
  })

  it('should load jobs from jobs.json', () => {
    const validJobs = [
      {
        name: 'Morning Briefing',
        cron: '0 8 * * *',
        action: 'agent_workflow',
        payload: { prompt: 'Good morning!' },
        enabled: true
      },
      {
        name: 'Cleanup',
        cron: '0 0 * * 0',
        action: 'script',
        payload: { path: 'cleanup.ts' },
        enabled: true
      }
    ]

    fs.writeFileSync(jobsPath, JSON.stringify(validJobs, null, 2))

    // We need a method to force reload or parse
    // For TDD, let's assume we add a loadJobs() public method or static helper
    const loaded = SchedulerService.getInstance().loadJobsFromFile()

    const parsed = ScheduleConfigSchema.safeParse(loaded)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toHaveLength(2)
      expect(parsed.data[0].name).toBe('Morning Briefing')
    }
  })

  it('should handle invalid config gracefully', () => {
    fs.writeFileSync(jobsPath, 'invalid json')
    const loaded = SchedulerService.getInstance().loadJobsFromFile()
    expect(loaded).toEqual([])
  })
})
