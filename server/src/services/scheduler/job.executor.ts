import * as cp from 'child_process'
import { Job } from './scheduler.schema.js'
import { bus, Events } from '../event-bus.js'

export class JobExecutor {
  public async execute(job: Job): Promise<void> {
    console.log(`[JobExecutor] Executing job: ${job.name} (${job.action})`)
    const startTime = Date.now()

    try {
      let output = ''
      if (job.action === 'script') {
        output = await this.executeScript(job)
      } else if (job.action === 'agent_workflow') {
        await this.executeAgentWorkflow(job)
        output = 'Agent workflow started'
      }

      bus.emit(Events.JOB_COMPLETED, {
        job: job.name,
        duration: Date.now() - startTime,
        output
      })
    } catch (error) {
      console.error(`[JobExecutor] Job ${job.name} failed:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      bus.emit(Events.JOB_FAILED, {
        job: job.name,
        error: msg
      })
    }
  }

  private executeScript(job: Job): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptPath = job.payload.path
      if (!scriptPath) {
        return reject(new Error('Missing script path'))
      }

      // Resolve path relative to USER/scripts if not absolute
      // We assume user scripts are in AppPaths.root/USER/scripts or similar?
      // Actually PRINCIPLES says USER/ is for user data.
      // Let's assume absolute path or relative to workspace root.
      // Plan says "USE/scripts/clean_tmp.ts", so let's check AppPaths.

      // For security, just supporting absolute or CWD relative for now.
      // In a real OS, we'd lock this down to a specific directory.

      const cmd = 'npx' // Use npx tsx to run typescript
      const args = ['tsx', scriptPath, ...(job.payload.args || [])]
      let stdout = ''
      let stderr = ''

      const child = cp.spawn(cmd, args, {
        cwd: process.cwd(), // Or AppPaths.user if we had it
        env: { ...process.env },
        stdio: 'pipe'
      })

      if (child.stdout) {
        child.stdout.on('data', (d) => {
          process.stdout.write(d)
          stdout += d.toString()
        })
      }
      if (child.stderr) {
        child.stderr.on('data', (d) => {
          process.stderr.write(d)
          stderr += d.toString()
        })
      }

      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) resolve(stdout)
        else reject(new Error(`Script exited with code ${code}. Stderr: ${stderr}`))
      })
    })
  }

  private async executeAgentWorkflow(job: Job): Promise<void> {
    // For now, we emit an event that the PersonalAgent can pick up
    // Or we could implement a headless runner here.
    // Given the complexity of standing up a full agent session from scratch here,
    // event dispatch is the clean "Phase 1" approach.

    bus.emit(Events.SCHEDULE_TRIGGER, {
      task: job.name,
      prompt: job.payload.prompt,
      parameters: job.payload
    })
  }
}
