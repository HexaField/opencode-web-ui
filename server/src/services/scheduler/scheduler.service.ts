import * as cron from 'node-cron'
import * as fs from 'fs'
import * as path from 'path'
import { AppPaths } from '../../config.js'
import { bus, Events } from '../event-bus.js'

interface ScheduleConfig {
  jobs: {
    cron: string
    task: string
    enabled: boolean
  }[]
}

export class SchedulerService {
  private static instance: SchedulerService
  private jobs: cron.ScheduledTask[] = []

  private constructor() {
    this.loadSchedule()
  }

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService()
    }
    return SchedulerService.instance
  }

  private loadSchedule() {
    const timetablePath = path.join(AppPaths.config, 'schedule.json')
    try {
      if (!fs.existsSync(AppPaths.config)) {
          fs.mkdirSync(AppPaths.config, { recursive: true })
      }
      
      if (fs.existsSync(timetablePath)) {
        const config: ScheduleConfig = JSON.parse(fs.readFileSync(timetablePath, 'utf-8'))
        this.registerJobs(config.jobs)
      } else {
        console.warn('[Scheduler] No schedule.json found. Creating default.')
        const defaultConfig: ScheduleConfig = {
          jobs: [
            { cron: '0 8 * * *', task: 'Runs morning briefing', enabled: true }
          ]
        }
        fs.writeFileSync(timetablePath, JSON.stringify(defaultConfig, null, 2))
        this.registerJobs(defaultConfig.jobs)
      }
    } catch (error) {
      console.error('[Scheduler] Failed to load schedule.json:', error)
    }
  }

  private registerJobs(jobs: ScheduleConfig['jobs']) {
    for (const job of jobs) {
      if (!job.enabled) continue

      try {
        const task = cron.schedule(job.cron, () => {
          console.log(`[Scheduler] Triggering job: ${job.task}`)
          bus.emit(Events.SCHEDULE_TRIGGER, { task: job.task })
        })
        this.jobs.push(task)
        console.log(`[Scheduler] Registered job: "${job.task}" [${job.cron}]`)
      } catch (error) {
        console.error(`[Scheduler] Invalid cron pattern for job "${job.task}": ${job.cron}`)
      }
    }
  }
}

export const schedulerService = SchedulerService.getInstance()
