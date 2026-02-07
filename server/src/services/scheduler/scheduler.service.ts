import * as cron from 'node-cron'
import * as fs from 'fs'
import * as path from 'path'
import { AppPaths } from '../../config.js'
import { Job, ScheduleConfigSchema } from './scheduler.schema.js'
import { JobExecutor } from './job.executor.js'

export class SchedulerService {
  private static instance: SchedulerService
  private jobs: cron.ScheduledTask[] = []
  private executor: JobExecutor

  private constructor() {
    this.executor = new JobExecutor()
    this.reload()
    this.watchConfig()
  }

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService()
    }
    return SchedulerService.instance
  }

  public reload() {
    // Stop existing jobs
    this.jobs.forEach((j) => j.stop())
    this.jobs = []

    const jobs = this.loadJobsFromFile()
    this.registerJobs(jobs)
  }

  private watchConfig() {
    // Watch for hot-reload
    const jobsPath = path.join(AppPaths.config, 'jobs.json')
    if (fs.existsSync(jobsPath)) {
      fs.watch(jobsPath, (eventType) => {
        if (eventType === 'change') {
          console.log('[Scheduler] Config changed. Reloading...')
          this.reload()
        }
      })
    }
  }

  public loadJobsFromFile(): Job[] {
    const jobsPath = path.join(AppPaths.config, 'jobs.json')
    try {
      if (!fs.existsSync(AppPaths.config)) {
        fs.mkdirSync(AppPaths.config, { recursive: true })
      }

      if (fs.existsSync(jobsPath)) {
        const fileContent = fs.readFileSync(jobsPath, 'utf-8')
        const parsed = ScheduleConfigSchema.safeParse(JSON.parse(fileContent))
        if (parsed.success) {
          return parsed.data
        } else {
          console.warn('[Scheduler] Invalid jobs.json schema:', parsed.error)
          return []
        }
      } else {
        // Fallback to old schedule.json or default
        console.warn('[Scheduler] No jobs.json found. Checking legacy schedule.json...')
        return this.loadLegacySchedule()
      }
    } catch (error) {
      console.error('[Scheduler] Failed to load jobs:', error)
      return []
    }
  }

  private loadLegacySchedule(): Job[] {
    const timetablePath = path.join(AppPaths.config, 'schedule.json')
    if (fs.existsSync(timetablePath)) {
      try {
        const oldConfig = JSON.parse(fs.readFileSync(timetablePath, 'utf-8'))
        // Map legacy to new Job format
        return oldConfig.jobs.map((j: any) => ({
          name: j.task,
          cron: j.cron,
          action: 'agent_workflow',
          payload: { prompt: j.task },
          enabled: j.enabled
        }))
      } catch (e) {
        return []
      }
    }
    return []
  }

  private registerJobs(jobs: Job[]) {
    for (const job of jobs) {
      if (!job.enabled) continue

      try {
        const task = cron.schedule(job.cron, () => {
          this.handleTrigger(job)
        })
        this.jobs.push(task)
        console.log(`[Scheduler] Registered job: "${job.name}" [${job.cron}]`)
      } catch (error) {
        console.error(`[Scheduler] Invalid cron pattern for job "${job.name}": ${job.cron}`)
      }
    }
  }

  private handleTrigger(job: Job) {
    console.log(`[Scheduler] Triggering job: ${job.name}`)
    // Execute the job logic
    this.executor.execute(job).catch((err) => {
      console.error(`[Scheduler] Job execution failed:`, err)
    })
  }
}

export const schedulerService = SchedulerService.getInstance()
