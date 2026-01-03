import express from 'express'
import { AuthenticatedRequest, validate, withClient } from '../../middleware'
import { OpencodeManager } from '../../opencode'
import { FolderQuerySchema } from '../common/common.schema'
import { CreateAgentSchema, DeleteAgentSchema } from './agents.schema'

export function registerAgentsRoutes(app: express.Application, manager: OpencodeManager) {
  app.get('/api/agents', validate(FolderQuerySchema), withClient(manager), async (req, res) => {
    try {
      const folder = (req as AuthenticatedRequest).targetFolder!
      const agents = await manager.listAgents(folder)
      res.json(agents)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/agents', validate(CreateAgentSchema), withClient(manager), async (req, res) => {
    try {
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { name, content } = req.body as { name: string; content: string }
      await manager.saveAgent(folder, name, content)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.delete('/api/agents/:name', validate(DeleteAgentSchema), withClient(manager), async (req, res) => {
    try {
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { name } = req.params
      await manager.deleteAgent(folder, name)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })
}
