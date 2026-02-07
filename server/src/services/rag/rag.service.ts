import * as path from 'path'
import * as fs from 'fs/promises'
import { AppPaths } from '../../config.js'
import { VectorStore } from './vector.store.js'
import { IndexerService } from './indexer.service.js'
import { toolRegistry } from '../tools/tool-registry.js'
import { ToolDefinition } from '../../types/packs.js'

export class RagService {
  private static instance: RagService
  public vectorStore: VectorStore
  public indexer: IndexerService
  private vectorsPath: string

  private constructor() {
    this.vectorsPath = path.join(AppPaths.memory, 'vectors')
    this.vectorStore = new VectorStore(this.vectorsPath)
    this.indexer = new IndexerService(this.vectorStore, AppPaths.memory)
  }

  static getInstance(): RagService {
    if (!RagService.instance) {
      RagService.instance = new RagService()
    }
    return RagService.instance
  }

  public async initialize() {
    await fs.mkdir(this.vectorsPath, { recursive: true })
    await this.vectorStore.initialize()

    // Register Tool
    this.registerSearchTool()

    // Initial Indexing (non-blocking)
    this.indexer.initialize().catch((err) => console.error('RAG Init Error:', err))
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
        const results = await this.vectorStore.search(args.query, 5)
        if (results.length === 0) return 'No relevant information found in knowledge base.'

        return results
          .map((r) => {
            const meta = r.metadata || {}
            let source = 'Unknown'
            if (meta.type === 'readme') source = `README: ${meta.workspace}`
            else if (meta.type === 'memory') source = `Memory: ${meta.id || meta.source}`
            else if (meta.type === 'meta') source = `Project Info: ${meta.workspace}`

            return `--- Source: ${source} ---\n${r.content}\n`
          })
          .join('\n')
      } catch (error: any) {
        return `Error searching knowledge base: ${error.message}`
      }
    })
  }
}

export const ragService = RagService.getInstance()
