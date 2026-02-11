import * as fs from 'fs/promises'
import * as path from 'path'
import { AppPaths } from '../../config.js'

export class ContextLoader {
  static async loadPrinciples(): Promise<string> {
    // Try to load from root, else return hardcoded defaults
    try {
      // Ideally assume PRINCIPLES.md is in the CWD (Project Root)
      const pPath = path.join(process.cwd(), 'PRINCIPLES.md')
      return await fs.readFile(pPath, 'utf-8')
    } catch (e) {
      return `# Principles (Default)
1. User Centricity
2. User/System Separation
3. Determinism First
4. Persistent Identity`
    }
  }

  static async loadMemoryMd(): Promise<string> {
    try {
      const memoryPath = path.join(AppPaths.memory, 'MEMORY.md')
      return await fs.readFile(memoryPath, 'utf-8')
    } catch (e) {
      return `No MEMORY.md found. Please create one in ${AppPaths.memory} to define your core identity and goals.`
    }
  }

  static async loadRecentJournals(): Promise<string> {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const [tContent, yContent] = await Promise.all([
      ContextLoader.readJournal(todayStr),
      ContextLoader.readJournal(yesterdayStr)
    ])

    return `
## Journal (${yesterdayStr})
${yContent}

## Journal (${todayStr})
${tContent}
`
  }

  private static async readJournal(dateStr: string): Promise<string> {
    try {
      const fpath = path.join(AppPaths.memory, 'journals', `${dateStr}.md`)
      return await fs.readFile(fpath, 'utf-8')
    } catch (e) {
      return '(No entry)'
    }
  }
}
