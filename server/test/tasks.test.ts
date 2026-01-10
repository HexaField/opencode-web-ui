import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Mock radicleService BEFORE importing server
vi.mock('../src/radicle', () => {
  interface MockTag {
    id: string
    name: string
    color: string
  }
  interface MockTask {
    id: string
    title: string
    status: string
    tags: MockTag[]
  }
  const tasks = new Map<string, MockTask>()
  return {
    radicleService: {
      getTasks: vi.fn(() => Promise.resolve(Array.from(tasks.values()))),
      createTask: vi.fn((_folder: string, task: Omit<MockTask, 'id' | 'tags'>) => {
        const id = 'task-' + Date.now()
        const newTask: MockTask = { ...task, id, tags: [] }
        tasks.set(id, newTask)
        return Promise.resolve(newTask)
      }),
      updateTask: vi.fn((_folder: string, id: string, updates: Partial<MockTask>) => {
        const task = tasks.get(id)
        if (task) {
          Object.assign(task, updates)
        }
        return Promise.resolve()
      }),
      deleteTask: vi.fn((_folder: string, id: string) => {
        tasks.delete(id)
        return Promise.resolve()
      }),
      getTags: vi.fn(() => Promise.resolve([])),
      addTag: vi.fn((_folder: string, taskId: string, tagId: string) => {
        const task = tasks.get(taskId)
        if (task) {
          task.tags = task.tags || []
          task.tags.push({ id: tagId, name: tagId, color: '#000' })
        }
        return Promise.resolve()
      }),
      removeTag: vi.fn((_folder: string, taskId: string, tagId: string) => {
        const task = tasks.get(taskId)
        if (task && task.tags) {
          task.tags = task.tags.filter((t) => t.id !== tagId)
        }
        return Promise.resolve()
      })
    }
  }
})

import { app, manager } from '../src/server.js'

interface Task {
  id: string
  title: string
  status: string
  tags?: { name: string; color: string }[]
}

interface Tag {
  id: string
  name: string
  color: string
}

describe('Tasks API Tests', () => {
  vi.setConfig({ testTimeout: 30000 })

  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-tasks-test-'))
    // No need to init radicle repo since we are mocking the service
  })

  afterAll(async () => {
    manager.shutdown()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should create a task', async () => {
    const res = await request(app)
      .post('/api/tasks?folder=' + encodeURIComponent(tempDir))
      .send({ title: 'Test Task', status: 'todo' })

    expect(res.status).toBe(200)
    const body = res.body as Task
    expect(body.title).toBe('Test Task')
    expect(body.id).toBeDefined()
  })

  it('should list tasks', async () => {
    const res = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const body = res.body as Task[]
    expect(body.length).toBeGreaterThan(0)
    expect(body[0].title).toBe('Test Task')
  })

  it('should update a task', async () => {
    // Get the task first
    const listRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const task = tasks[0]

    const res = await request(app)
      .put(`/api/tasks/${task.id}?folder=` + encodeURIComponent(tempDir))
      .send({ status: 'in-progress' })

    expect(res.status).toBe(200)

    // Verify update
    const verifyRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const updatedTasks = verifyRes.body as Task[]
    const updatedTask = updatedTasks.find((t) => t.id === task.id)
    expect(updatedTask).toBeDefined()
    expect(updatedTask!.status).toBe('in-progress')
  })

  it('should create and assign a tag', async () => {
    // Create tag
    const tagRes = await request(app)
      .post('/api/tags?folder=' + encodeURIComponent(tempDir))
      .send({ name: 'Bug', color: '#ff0000' })

    expect(tagRes.status).toBe(200)
    const tagBody = tagRes.body as Tag
    const tagId = tagBody.id

    // Get task
    const listRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const taskId = tasks[0].id

    // Assign tag
    const assignRes = await request(app)
      .post(`/api/tasks/${taskId}/tags?folder=` + encodeURIComponent(tempDir))
      .send({ tag_id: tagId })

    expect(assignRes.status).toBe(200)

    // Verify assignment
    const verifyRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const verifyTasks = verifyRes.body as Task[]
    const task = verifyTasks.find((t) => t.id === taskId)
    expect(task).toBeDefined()
    expect(task!.tags).toHaveLength(1)
    expect(task!.tags![0].name).toBe('Bug')
  })

  it('should delete a task', async () => {
    const listRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const taskId = tasks[0].id

    const res = await request(app).delete(`/api/tasks/${taskId}?folder=` + encodeURIComponent(tempDir))

    expect(res.status).toBe(200)

    const verifyRes = await request(app).get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    expect(verifyRes.status).toBe(200)
    expect(Array.isArray(verifyRes.body)).toBe(true)
    const verifyTasks = verifyRes.body as Task[]
    expect(verifyTasks.find((t) => t.id === taskId)).toBeUndefined()
  })
})
