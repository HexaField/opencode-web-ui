/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { exec as _exec, ExecOptions } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(_exec) as (
  command: string,
  options?: ExecOptions
) => Promise<{ stdout: string; stderr: string }>

async function exec(command: string, options?: ExecOptions): Promise<{ stdout: string; stderr: string }> {
  // Default timeout 10s
  const opts = { timeout: 10000, ...options }
  return execPromise(command, opts)
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  parent_id: string | null
  position: number
  created_at: number
  updated_at: number
  tags: Tag[]
  dependencies: string[]
}

export interface Tag {
  id: string
  name: string
  color: string
}

interface RadicleIssue {
  id: string // OID
  title: string
  state: { status: 'open' | 'closed' }
  labels: string[]
  thread: {
    comments: Record<string, { body: string; timestamp: number }>
    timeline: string[]
  }
}

interface TaskMetadata {
  parent_id?: string | null
  position?: number
  dependencies?: string[]
}

export class RadicleService {
  private ridCache: Record<string, string> = {}

  private async getRid(folder: string): Promise<string> {
    if (this.ridCache[folder]) return this.ridCache[folder]
    try {
      console.error('PATH:', process.env.PATH)
      const { stdout } = await exec('rad .', { cwd: folder })
      const rid = stdout.trim()
      this.ridCache[folder] = rid
      return rid
    } catch (e) {
      console.error('getRid failed for folder:', folder, e)
      // If not a repo, maybe init? But for now assume it is or fail.
      // The user might be in a subfolder.
      throw new Error('Not a Radicle repository')
    }
  }

  private parseMetadata(description: string): { metadata: TaskMetadata; cleanDescription: string } {
    const match = description.match(/<!-- metadata\s*([\s\S]*?)\s*-->$/)
    if (match) {
      try {
        const metadata = JSON.parse(match[1])
        const cleanDescription = description.replace(match[0], '').trim()
        return { metadata, cleanDescription }
      } catch (e) {
        console.error('Failed to parse metadata', e)
      }
    }
    return { metadata: {}, cleanDescription: description }
  }

  private formatDescription(description: string, metadata: TaskMetadata): string {
    return `${description.trim()}\n\n<!-- metadata\n${JSON.stringify(metadata, null, 2)}\n-->`
  }

  async getTasks(folder: string): Promise<Task[]> {
    const rid = await this.getRid(folder)
    // Get all issue OIDs
    // rad cob list returns OIDs, one per line
    const { stdout: listOut } = await exec(`rad cob list --repo ${rid} --type xyz.radicle.issue`, { cwd: folder })
    const oids = listOut.trim().split('\n').filter(Boolean)

    if (oids.length === 0) return []

    // Fetch details for each (parallel)
    const tasks = await Promise.all(
      oids.map(async (oid) => {
        try {
          const { stdout: jsonOut } = await exec(
            `rad cob show --repo ${rid} --type xyz.radicle.issue --object ${oid} --format json`,
            { cwd: folder }
          )
          const issue: RadicleIssue = JSON.parse(jsonOut)

          // The description is the body of the first comment (which matches the issue OID usually, or the first in timeline)
          // Actually, the issue OID is the ID of the first operation (create).
          // The comments map keys are comment IDs.
          // The first comment in the timeline is the description.
          const firstCommentId = issue.thread.timeline[0]
          const firstComment = issue.thread.comments[firstCommentId]
          const rawDescription = firstComment ? firstComment.body : ''
          const createdAt = firstComment ? firstComment.timestamp * 1000 : Date.now() // Radicle timestamp is seconds? Guide says 1766207282000 which is ms.
          // Wait, 1766207282000 is definitely ms (year 2025).

          const { metadata, cleanDescription } = this.parseMetadata(rawDescription)

          let status: Task['status'] = 'todo'
          if (issue.state.status === 'closed') {
            status = 'done'
          } else if (issue.labels.includes('status:in-progress')) {
            status = 'in-progress'
          }

          const tags: Tag[] = issue.labels
            .filter((l) => !l.startsWith('status:'))
            .map((l) => ({ id: l, name: l, color: '#888888' })) // Default color

          return {
            id: oid,
            title: issue.title,
            description: cleanDescription,
            status,
            parent_id: metadata.parent_id || null,
            position: metadata.position || 0,
            created_at: createdAt,
            updated_at: createdAt, // Radicle doesn't easily give updated_at for the issue itself without parsing all edits
            tags,
            dependencies: metadata.dependencies || []
          }
        } catch (e) {
          console.error(`Failed to fetch issue ${oid}`, e)
          return null
        }
      })
    )

    return tasks.filter((t): t is Task => t !== null)
  }

  async createTask(folder: string, task: Partial<Task>): Promise<Task> {
    const metadata: TaskMetadata = {
      parent_id: task.parent_id,
      position: task.position,
      dependencies: task.dependencies
    }
    const description = this.formatDescription(task.description || '', metadata)

    // Escape quotes for shell
    const safeTitle = (task.title || 'Untitled').replace(/"/g, '\\"')
    const safeDesc = description.replace(/"/g, '\\"')

    // Use --no-announce to be faster/quieter? Or maybe not.
    // Using --quiet to avoid TUI output if possible, but rad issue open prints the table.
    // We need to capture the ID.
    const cmd = `rad issue open --title "${safeTitle}" --description "${safeDesc}" --no-announce`
    const { stdout } = await exec(cmd, { cwd: folder })

    // Parse ID from output
    // │ Issue   d7f5776ac448173ba0f3e0308f557e3d4ea6053b              │
    const match = stdout.match(/Issue\s+([a-z0-9]+)/)
    if (!match) {
      throw new Error('Failed to parse issue ID from output')
    }
    const id = match[1]

    // Set status if needed
    if (task.status === 'in-progress') {
      await exec(`rad issue label ${id} --add status:in-progress --no-announce`, { cwd: folder })
    } else if (task.status === 'done') {
      await exec(`rad issue state ${id} --closed --no-announce`, { cwd: folder })
    }

    return {
      id,
      title: task.title || 'Untitled',
      description: task.description || '',
      status: task.status || 'todo',
      parent_id: task.parent_id || null,
      position: task.position || 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      tags: [],
      dependencies: task.dependencies || []
    }
  }

  async updateTask(folder: string, id: string, updates: Partial<Task>): Promise<void> {
    // We need to fetch the current description to preserve metadata if we are only updating title/status
    // Or if we are updating metadata, we need to merge it.

    // Optimization: If only status/tags, we don't need to fetch description.
    // But if parent_id/position/dependencies/description changed, we do.

    const needsDescUpdate =
      updates.description !== undefined ||
      updates.parent_id !== undefined ||
      updates.position !== undefined ||
      updates.dependencies !== undefined

    if (needsDescUpdate || updates.title !== undefined) {
      // Fetch current
      const rid = await this.getRid(folder)
      const { stdout: jsonOut } = await exec(
        `rad cob show --repo ${rid} --type xyz.radicle.issue --object ${id} --format json`,
        { cwd: folder }
      )
      const issue: RadicleIssue = JSON.parse(jsonOut)
      const firstCommentId = issue.thread.timeline[0]
      const rawDescription = issue.thread.comments[firstCommentId].body
      const { metadata, cleanDescription } = this.parseMetadata(rawDescription)

      const newDesc = updates.description !== undefined ? updates.description : cleanDescription
      const newMetadata: TaskMetadata = {
        parent_id: updates.parent_id !== undefined ? updates.parent_id : metadata.parent_id,
        position: updates.position !== undefined ? updates.position : metadata.position,
        dependencies: updates.dependencies !== undefined ? updates.dependencies : metadata.dependencies
      }

      const finalDesc = this.formatDescription(newDesc, newMetadata)
      const safeDesc = finalDesc.replace(/"/g, '\\"')

      let cmd = `rad issue edit ${id} --description "${safeDesc}" --no-announce`
      if (updates.title) {
        const safeTitle = updates.title.replace(/"/g, '\\"')
        cmd += ` --title "${safeTitle}"`
      }
      await exec(cmd, { cwd: folder })
    }

    if (updates.status) {
      try {
        if (updates.status === 'done') {
          await exec(`rad issue state ${id} --closed --no-announce`, { cwd: folder })
        } else {
          // Ensure open
          try {
            await exec(`rad issue state ${id} --open --no-announce`, { cwd: folder })
          } catch (e) {
            console.warn('Failed to set issue state to open (might be already open)', e)
          }

          if (updates.status === 'in-progress') {
            await exec(`rad issue label ${id} --add status:in-progress --no-announce`, { cwd: folder })
          } else {
            // todo: remove in-progress label
            try {
              await exec(`rad issue label ${id} --delete status:in-progress --no-announce`, { cwd: folder })
            } catch (e) {
              // ignore if label doesn't exist
            }
          }
        }
      } catch (e) {
        console.error('Failed to update task status in Radicle', e)
        throw e
      }
    }
  }

  async deleteTask(folder: string, id: string): Promise<void> {
    await exec(`rad issue delete ${id} --no-announce`, { cwd: folder })
  }

  async getTags(folder: string): Promise<Tag[]> {
    const tasks = await this.getTasks(folder)
    const tagsMap = new Map<string, Tag>()
    for (const task of tasks) {
      for (const tag of task.tags) {
        tagsMap.set(tag.id, tag)
      }
    }
    return Array.from(tagsMap.values())
  }

  async addTag(folder: string, taskId: string, tagName: string): Promise<void> {
    await exec(`rad issue label ${taskId} --add "${tagName}" --no-announce`, { cwd: folder })
  }

  async removeTag(folder: string, taskId: string, tagName: string): Promise<void> {
    await exec(`rad issue label ${taskId} --delete "${tagName}" --no-announce`, { cwd: folder })
  }
}

export const radicleService = new RadicleService()
