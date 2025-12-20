import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
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
    await fs.mkdir(path.join(tempDir, '.agent', 'tasks'), { recursive: true })
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
    const res = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const body = res.body as Task[]
    expect(body.length).toBeGreaterThan(0)
    expect(body[0].title).toBe('Test Task')
  })

  it('should update a task', async () => {
    // Get the task first
    const listRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const task = tasks[0]

    const res = await request(app)
      .put(`/api/tasks/${task.id}?folder=` + encodeURIComponent(tempDir))
      .send({ status: 'in-progress' })
    
    expect(res.status).toBe(200)

    // Verify update
    const verifyRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
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
    const listRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const taskId = tasks[0].id

    // Assign tag
    const assignRes = await request(app)
      .post(`/api/tasks/${taskId}/tags?folder=` + encodeURIComponent(tempDir))
      .send({ tag_id: tagId })
    
    expect(assignRes.status).toBe(200)

    // Verify assignment
    const verifyRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const verifyTasks = verifyRes.body as Task[]
    const task = verifyTasks.find((t) => t.id === taskId)
    expect(task).toBeDefined()
    expect(task!.tags).toHaveLength(1)
    expect(task!.tags![0].name).toBe('Bug')
  })

  it('should delete a task', async () => {
    const listRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const tasks = listRes.body as Task[]
    const taskId = tasks[0].id

    const res = await request(app)
      .delete(`/api/tasks/${taskId}?folder=` + encodeURIComponent(tempDir))
    
    expect(res.status).toBe(200)

    const verifyRes = await request(app)
      .get('/api/tasks?folder=' + encodeURIComponent(tempDir))
    const verifyTasks = verifyRes.body as Task[]
    expect(verifyTasks.find((t) => t.id === taskId)).toBeUndefined()
  })
})
