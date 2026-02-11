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
      const results = await ragService.searcher.search(query, { limit: 10 })
      res.json({ results })
    } catch (error) {
      console.error('RAG Search Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })

  app.post('/api/rag/index', async (req, res) => {
    // Manually trigger re-indexing
    try {
      // Sync memory
      await ragService.indexer.sync()

      // Workspace indexing is currently paused in V2 architecture (Principles: User Memory First)

      res.json({ success: true })
    } catch (error) {
      console.error('RAG Index Error:', error)
      res.status(500).json({ error: 'Indexing failed' })
    }
  })
}
