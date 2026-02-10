import * as path from 'path'
import * as fs from 'fs/promises'
import { AppPaths } from '../../config.js'
import { IndexerService } from './indexer.service.js'
import { HybridSearcher } from './hybrid_searcher.js'
import { dbService } from '../memory/db.js'
import { toolRegistry } from '../tools/tool-registry.js'
import { ToolDefinition } from '../../types/packs.js'

export class RagService {
  private static instance: RagService
  public searcher: HybridSearcher
  public indexer: IndexerService

  private constructor() {
    this.indexer = new IndexerService(AppPaths.memory)
    this.searcher = new HybridSearcher(dbService.getDb())
  }

  static getInstance(): RagService {
    if (!RagService.instance) {
      RagService.instance = new RagService()
    }
    return RagService.instance
  }

  public async initialize() {
    // Register Tool
    this.registerSearchTool()

    // Initial Indexing (non-blocking)
    // We only trigger sync if DB is empty? No, delta sync handles it.
    this.indexer.sync().catch((err) => console.error('RAG Init Error:', err))
  }

  private registerSearchTool() {
    const def: ToolDefinition = {
      name: 'search_knowledge_base',
      description:
        'Search personal knowledge base, project documentation, and memories using semantic search. Use this for broad questions about projects, concepts, or previous lessons.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The natural language query to search for'
          }
        },
        required: ['query']
      }
    }

    toolRegistry.registerTool(def, async (args: { query: string }) => {
      console.log('[RAG] Searching for:', args.query)
      try {
        const results = await this.searcher.search(args.query, { limit: 5 })
        if (results.length === 0) return 'No relevant information found in knowledge base.'

        return results
          .map((r) => {
            // Relativize path for display if possible, or just show filename
            const filename = path.basename(r.filePath)
            return `--- Source: ${filename} (Score: ${r.score.toFixed(3)}) ---\n${r.content}\n`
          })
          .join('\n')
      } catch (error: any) {
        return `Error searching knowledge base: ${error.message}`
      }
    })
  }
}

export const ragService = RagService.getInstance()
