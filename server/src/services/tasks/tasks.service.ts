import express from 'express'
import { validate } from '../../middleware'
import { radicleService } from '../../radicle'
import { FolderQuerySchema } from '../common/common.schema'
import { GetSessionSchema } from '../sessions/sessions.schema'
import { CreateTagSchema, CreateTaskSchema, DeleteTaskTagSchema, TaskTagSchema, UpdateTaskSchema } from './tasks.schema'

export function registerTasksRoutes(app: express.Application) {
  app.get('/api/tasks', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const tasks = await radicleService.getTasks(folder)
      res.json(tasks)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.post('/api/tasks', validate(CreateTaskSchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { title, description, parent_id, status, dependencies, kind } = req.body as {
        title: string
        description?: string
        parent_id?: string
        status?: 'todo' | 'in-progress' | 'done'
        dependencies?: string[]
        kind?: 'task' | 'plan'
      }
      const task = await radicleService.createTask(folder, {
        title,
        description,
        parent_id,
        status,
        dependencies,
        kind
      })
      res.json(task)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.put('/api/tasks/:id', validate(UpdateTaskSchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { id } = req.params as { id: string }
      const { title, description, status, parent_id, position, dependencies, kind } = req.body as {
        title?: string
        description?: string
        status?: 'todo' | 'in-progress' | 'done'
        parent_id?: string
        position?: number
        dependencies?: string[]
        kind?: 'task' | 'plan'
      }

      await radicleService.updateTask(folder, id, {
        title,
        description,
        status,
        parent_id,
        position,
        dependencies,
        kind
      })
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.delete('/api/tasks/:id', validate(GetSessionSchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { id } = req.params as { id: string }
      await radicleService.deleteTask(folder, id)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.get('/api/tags', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const tags = await radicleService.getTags(folder)
      res.json(tags)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.post('/api/tags', validate(CreateTagSchema), (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { name, color } = req.body as { name: string; color: string }
      // Radicle tags are just strings, so we don't persist them separately.
      // We just return what was sent to satisfy the frontend.
      res.json({ id: name, name, color })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.post('/api/tasks/:id/tags', validate(TaskTagSchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { id } = req.params as { id: string }
      const { tag_id } = req.body as { tag_id: string }
      await radicleService.addTag(folder, id, tag_id)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })

  app.delete('/api/tasks/:id/tags/:tagId', validate(DeleteTaskTagSchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { id, tagId } = req.params as { id: string; tagId: string }
      await radicleService.removeTag(folder, id, tagId)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: String(error) })
    }
  })
}
