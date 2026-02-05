import express from 'express'
import { ragService } from './rag.service.js'

export function registerRagRoutes(app: express.Application) {
  app.get('/api/rag/search', async (req, res) => {
    const query = req.query.q as string
    if (!query) {
      res.status(400).json({ error: 'Query parameter "q" is required' })
      return
    }

    try {
      const results = await ragService.vectorStore.search(query, 10)
      res.json({ results })
    } catch (error) {
      console.error('RAG Search Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  app.post('/api/rag/index', async (req, res) => {
    // Manually trigger re-indexing
    try {
      await ragService.indexer.indexMemory()
      // If we provided a workspace path body
      const { workspacePath } = req.body
      if (workspacePath) {
        await ragService.indexer.indexWorkspace(workspacePath)
      }
      res.json({ success: true })
    } catch (error) {
      console.error('RAG Index Error:', error)
      res.status(500).json({ error: 'Indexing failed' })
    }
  })
}
