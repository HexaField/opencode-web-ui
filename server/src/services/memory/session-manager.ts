import * as fs from 'fs/promises'
import * as path from 'path'
import { AppPaths } from '../../config.js'

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface SessionMetadata {
  id: string
  date: string
  title?: string
}

export class SessionManager {
  private sessionsDir: string

  constructor() {
    this.sessionsDir = path.join(AppPaths.memory, 'sessions')
  }

  private async ensureSessionsDir() {
    await fs.mkdir(this.sessionsDir, { recursive: true })
  }

  private getSessionPath(sessionId: string): string {
    // Basic sanitization
    const safeId = sessionId.replace(/[^a-z0-9-_]/gi, '_')
    // We might use date in future: const date = new Date().toISOString().split('T')[0]
    return path.join(this.sessionsDir, `${safeId}.jsonl`)
  }

  public async createSession(sessionId: string, initialMessage?: SessionMessage): Promise<void> {
    await this.ensureSessionsDir()
    const filePath = this.getSessionPath(sessionId)

    // Check if exists
    try {
      await fs.access(filePath)
      // If exists, do nothing
    } catch {
      // Create empty or with initial message
      if (initialMessage) {
        await this.appendMessage(sessionId, initialMessage)
      } else {
        await fs.writeFile(filePath, '', 'utf8')
      }
    }
  }

  public async appendMessage(sessionId: string, message: SessionMessage): Promise<void> {
    await this.ensureSessionsDir()
    const filePath = this.getSessionPath(sessionId)
    const line = JSON.stringify(message) + '\n'
    await fs.appendFile(filePath, line, 'utf8')
  }

  public async getSession(sessionId: string): Promise<SessionMessage[]> {
    const filePath = this.getSessionPath(sessionId)
    try {
      const content = await fs.readFile(filePath, 'utf8')
      return content
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    } catch (error) {
      if ((error as any).code === 'ENOENT') return []
      throw error
    }
  }

  public async listRecentSessions(limit: number = 10): Promise<string[]> {
    await this.ensureSessionsDir()
    const files = await fs.readdir(this.sessionsDir)
    // Sort by modification time
    const stats = await Promise.all(
      files
        .filter((f) => f.endsWith('.jsonl'))
        .map(async (file) => {
          const filePath = path.join(this.sessionsDir, file)
          const stat = await fs.stat(filePath)
          return { file, mtime: stat.mtime }
        })
    )

    return stats
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, limit)
      .map((s) => s.file.replace('.jsonl', ''))
  }
}

export const sessionManager = new SessionManager()
