import * as fs from 'fs/promises'
import * as path from 'path'
import { AppPaths } from '../../config.js'

export class LearningService {
  private learnedPath: string
  private failuresPath: string

  constructor() {
    // We stick to AppPaths.memory, but one could argue for AppPaths.telos.
    // Based on User/System separation, LEARNING is part of Identity/Memory.
    // PLAN_02 says "USER/MEMORY/failures.md" implies AppPaths.memory.
    this.learnedPath = path.join(AppPaths.memory, 'LEARNED.md')
    this.failuresPath = path.join(AppPaths.memory, 'failures.md')
  }

  public async recordFailure(context: string, error: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const entry = `\n## Failure [${timestamp}]\n**Context**: ${context}\n**Error**: ${error}\n`
    await fs.appendFile(this.failuresPath, entry, 'utf8')
  }

  public async recordLesson(trigger: string, lesson: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const entry = `\n## Lesson [${timestamp}]\n**Trigger**: ${trigger}\n**Lesson**: ${lesson}\n`
    await fs.appendFile(this.learnedPath, entry, 'utf8')
  }

  public async getLearnedLessons(): Promise<string> {
    try {
      return await fs.readFile(this.learnedPath, 'utf8')
    } catch (error) {
      if ((error as any).code === 'ENOENT') return 'No lessons learned yet.'
      throw error
    }
  }
}

export const learningService = new LearningService()
