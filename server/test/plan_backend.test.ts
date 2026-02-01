import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { radicleService } from '../src/radicle'

describe('Plan/Task Backend Tests', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-plans-test-'))
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should create a plan task with kind="plan"', async () => {
    const task = await radicleService.createTask(tempDir, {
      title: 'My Plan',
      description: '- [ ] Item 1',
      kind: 'plan' as any // Pending type update
    })

    expect(task.kind).toBe('plan')
    expect(task.title).toBe('My Plan')
  })

  it('should retrieve plan tasks via getTasks', async () => {
    const tasks = await radicleService.getTasks(tempDir)
    const plan = tasks.find((t: any) => t.kind === 'plan')
    expect(plan).toBeDefined()
    expect(plan?.title).toBe('My Plan')
  })

  it('should update a task kind', async () => {
    // Create a normal task
    const task = await radicleService.createTask(tempDir, {
      title: 'Normal Task',
      kind: 'task' as any
    })

    // Update it to be a plan (unlikely but possible)
    await radicleService.updateTask(tempDir, task.id, {
      kind: 'plan' as any,
      description: 'Now a plan'
    })

    const tasks = await radicleService.getTasks(tempDir)
    const updated = tasks.find((t) => t.id === task.id)
    expect(updated?.kind).toBe('plan')
    expect(updated?.description).toBe('Now a plan')
  })
})
