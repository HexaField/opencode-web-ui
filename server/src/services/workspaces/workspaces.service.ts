import express from 'express'
import { WorkspaceRegistry } from './workspace.registry.js'
import { TemplateLoader } from '../templates/template.loader.js'
import { scaffold_project } from '../../packs/standard/scaffold/index.js'
import { AppPaths } from '../../config.js'

export function registerWorkspacesRoutes(app: express.Application) {
  app.get('/api/workspaces', async (_req, res) => {
    try {
      const workspaces = await WorkspaceRegistry.getWorkspaces()
      res.json({ workspaces, homePath: AppPaths.root })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.get('/api/templates', async (_req, res) => {
    try {
      const templates = await TemplateLoader.listTemplates()
      res.json({ templates })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  app.post('/api/workspaces', async (req, res) => {
    try {
      const { template, path } = req.body
      if (!template || !path) {
        res.status(400).json({ error: 'Missing template or path' })
        return
      }
      const message = await scaffold_project({ template, path })
      res.status(201).json({ success: true, message, path })
    } catch (e) {
      res.status(500).json({ error: (e as any).message || String(e) })
    }
  })
}
