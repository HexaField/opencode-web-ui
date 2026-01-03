import express from 'express'
import { validate } from '../../middleware'
import { OpencodeManager } from '../../opencode'
import { ConnectSchema } from './misc.schema'

export function registerMiscRoutes(app: express.Application, manager: OpencodeManager) {
  app.post('/api/connect', validate(ConnectSchema), async (req, res) => {
    const { folder } = req.body as { folder?: string }
    if (!folder) {
      res.status(400).json({ error: 'Missing folder in body' })
      return
    }
    try {
      await manager.connect(folder)
      res.json({ success: true, folder })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.get('/api/models', async (_req, res) => {
    try {
      const models = await manager.listModels()
      res.json(models)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })
}
