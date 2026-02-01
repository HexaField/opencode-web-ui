import express from 'express'
import { AuthenticatedRequest, validate, withFolder } from '../../middleware'
import { OpencodeManager } from '../../opencode'
import { parseAgent, serializeAgent, type AgentConfig } from '../../utils/frontmatter.js'
import { FolderQuerySchema } from '../common/common.schema'
import { CreateAgentSchema, DeleteAgentSchema } from './agents.schema'

export function registerAgentsRoutes(app: express.Application, manager: OpencodeManager) {
  app.get('/api/agents', validate(FolderQuerySchema), withFolder(manager), async (req, res) => {
    try {
      const folder = (req as AuthenticatedRequest).targetFolder!
      const rawAgents = await manager.listAgents(folder)
      const agents = rawAgents.map((agent) => {
        const { config, prompt } = parseAgent(agent.content)
        return {
          ...agent,
          config,
          prompt
        }
      })
      res.json(agents)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/agents', validate(CreateAgentSchema), withFolder(manager), async (req, res) => {
    try {
      const folder = (req as AuthenticatedRequest).targetFolder!
      const body = req.body as { name: string; content?: string; config?: AgentConfig; prompt?: string }

      let finalContent = body.content
      if (!finalContent && body.config && body.prompt) {
        finalContent = serializeAgent(body.config, body.prompt)
      } else if (!finalContent) {
        throw new Error('Missing content or config+prompt')
      }

      await manager.saveAgent(folder, body.name, finalContent)
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.delete('/api/agents/:name', validate(DeleteAgentSchema), withFolder(manager), async (req, res) => {
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
