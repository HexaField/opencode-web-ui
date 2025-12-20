import { exec } from 'child_process'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { radicleService } from '../src/radicle'

const execAsync = promisify(exec)

describe('RadicleService', () => {
  let folder: string
  let taskId: string

  beforeAll(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-radicle-test-'))
    await execAsync('git init', { cwd: folder })
    await execAsync('git config user.email "test@example.com"', { cwd: folder })
    await execAsync('git config user.name "Test User"', { cwd: folder })
    await execAsync('git commit --allow-empty -m "Initial commit"', { cwd: folder })

    // Initialize radicle
    const projectName = 'radicle-test-' + Date.now()
    try {
      await execAsync(
        `rad init --name ${projectName} --description "Radicle Test" --default-branch main --public --no-confirm`,
        { cwd: folder }
      )
    } catch (error) {
      console.warn('Failed to initialize radicle repo:', error)
    }
  })

  afterAll(async () => {
    if (folder) {
      await fs.rm(folder, { recursive: true, force: true })
    }
  })

  it('should create a task', async () => {
    const task = await radicleService.createTask(folder, {
      title: 'Test Task',
      description: 'Description',
      status: 'todo',
      position: 1
    })
    expect(task.id).toBeDefined()
    expect(task.title).toBe('Test Task')
    expect(task.status).toBe('todo')
    taskId = task.id
  })

  it('should get tasks', async () => {
    const tasks = await radicleService.getTasks(folder)
    const task = tasks.find((t) => t.id === taskId)
    expect(task).toBeDefined()
    expect(task?.title).toBe('Test Task')
    expect(task?.description).toBe('Description')
    expect(task?.position).toBe(1)
  })

  it('should update task status', async () => {
    await radicleService.updateTask(folder, taskId, { status: 'in-progress' })
    let tasks = await radicleService.getTasks(folder)
    let task = tasks.find((t) => t.id === taskId)
    expect(task?.status).toBe('in-progress')

    // Update back to todo
    await radicleService.updateTask(folder, taskId, { status: 'todo' })
    tasks = await radicleService.getTasks(folder)
    task = tasks.find((t) => t.id === taskId)
    expect(task?.status).toBe('todo')
  })

  it('should update task metadata', async () => {
    await radicleService.updateTask(folder, taskId, { position: 2, parent_id: 'some-parent' })
    const tasks = await radicleService.getTasks(folder)
    const task = tasks.find((t) => t.id === taskId)
    expect(task?.position).toBe(2)
    expect(task?.parent_id).toBe('some-parent')
  })

  it('should add and remove tags', async () => {
    await radicleService.addTag(folder, taskId, 'bug')
    let tasks = await radicleService.getTasks(folder)
    let task = tasks.find((t) => t.id === taskId)
    expect(task?.tags.some((t) => t.name === 'bug')).toBe(true)

    await radicleService.removeTag(folder, taskId, 'bug')
    tasks = await radicleService.getTasks(folder)
    task = tasks.find((t) => t.id === taskId)
    expect(task?.tags.some((t) => t.name === 'bug')).toBe(false)
  })

  it('should delete task', async () => {
    await radicleService.deleteTask(folder, taskId)
    const tasks = await radicleService.getTasks(folder)
    const task = tasks.find((t) => t.id === taskId)
    expect(task).toBeUndefined()
  })
})
