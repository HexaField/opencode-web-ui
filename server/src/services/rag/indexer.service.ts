import * as fs from 'fs/promises'
import * as path from 'path'
import { VectorStore } from './vector.store.js'
import { WorkspaceRegistry } from '../workspaces/workspace.registry.js'

export class IndexerService {
  constructor(
    private vectorStore: VectorStore,
    private memoryPath: string
  ) {}

  public async initialize() {
    // Optional: run full re-indexing on startup?
    // For now, minimal init.
  }

  public async indexWorkspace(folderPath: string) {
    const ws = await WorkspaceRegistry.getWorkspace(folderPath)
    if (!ws) return

    // 1. Index README
    try {
      const readmePath = path.join(folderPath, 'README.md')
      const content = await fs.readFile(readmePath, 'utf-8')
      if (content.length > 50) {
        // arbitrary noise filter
        await this.vectorStore.addDocument(
          `readme:${folderPath}`,
          content.slice(0, 8000), // simplistic chunking limit for embedding model
          { type: 'readme', workspace: ws.name, path: folderPath }
        )
      }
    } catch {
      // No readme, ignore
    }

    // 2. Index Workspace Metadata
    await this.vectorStore.addDocument(
      `meta:${folderPath}`,
      `Project ${ws.name}. Tags: ${ws.tags.join(', ')}. Path: ${ws.path}`,
      { type: 'meta', workspace: ws.name, path: folderPath }
    )

    await this.vectorStore.save()
  }

  public async indexMemory() {
    try {
      const files = await fs.readdir(this.memoryPath)
      for (const file of files) {
        if (file.endsWith('.md')) {
          const fullPath = path.join(this.memoryPath, file)
          const content = await fs.readFile(fullPath, 'utf-8')
          await this.vectorStore.addDocument(`memory:${file}`, content, { type: 'memory', source: file })
        }
      }
      await this.vectorStore.save()
    } catch (e) {
      console.error('Failed to index memory', e)
    }
  }
}
