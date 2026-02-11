import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import { DatabaseService } from '../memory/db.js'
import { EmbeddingService } from './embedding.service.js'

export class IndexerService {
  private db = DatabaseService.getInstance().getDb()
  private embedder = EmbeddingService.getInstance()

  constructor(private memoryPath: string) {}

  public async sync() {
    // 1. Scan Files
    const files = await this.scanFiles(this.memoryPath)

    // 2. Get DB State
    const storedFiles = this.db.prepare('SELECT path, last_modified, hash FROM files').all() as any[]
    const storedMap = new Map(storedFiles.map((f) => [f.path, f]))

    // 3. Process
    for (const filePath of files) {
      const relPath = path.relative(this.memoryPath, filePath)
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf-8')
      const hash = crypto.createHash('md5').update(content).digest('hex')

      const existing = storedMap.get(relPath)

      // Check if changed
      if (!existing || existing.hash !== hash || existing.last_modified !== stats.mtimeMs) {
        await this.indexFile(relPath, content, stats.mtimeMs, hash)
      }

      storedMap.delete(relPath)
    }

    // 4. Delete removed files
    for (const [relPath, _] of storedMap) {
      this.db.prepare('DELETE FROM files WHERE path = ?').run(relPath)
    }
  }

  private async scanFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await this.scanFiles(fullPath)))
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
    return files
  }

  private async indexFile(relPath: string, content: string, mtime: number, hash: string) {
    const txn = this.db.transaction(async () => {
      // Upsert File
      this.db
        .prepare(`
        INSERT INTO files (path, last_modified, hash) VALUES (?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET last_modified=excluded.last_modified, hash=excluded.hash
      `)
        .run(relPath, mtime, hash)

      // Get ID
      const row = this.db.prepare('SELECT id FROM files WHERE path = ?').get(relPath) as { id: number }
      const fileId = row.id

      // Delete old chunks
      this.db.prepare('DELETE FROM chunks WHERE file_id = ?').run(fileId)

      // Create chunks
      const chunks = this.chunkText(content)
      const insertChunk = this.db.prepare(`
        INSERT INTO chunks (file_id, content, start_line, end_line, embedding)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const chunk of chunks) {
        let vector: Float32Array | null = null
        try {
          vector = await this.embedder.embed(chunk.text)
        } catch (e) {
          console.error(`Failed to embed chunk for ${relPath}`, e)
        }

        // Store as Buffer if exists
        const buffer = vector ? Buffer.from(vector.buffer) : null
        insertChunk.run(fileId, chunk.text, chunk.start, chunk.end, buffer)
      }
    })

    await txn()
  }

  private chunkText(text: string): { text: string; start: number; end: number }[] {
    const lines = text.split('\n')
    const chunks: { text: string; start: number; end: number }[] = []
    let currentChunk: string[] = []
    let startLine = 1

    lines.forEach((line, i) => {
      currentChunk.push(line)
      if (line.trim() === '' || currentChunk.join('\n').length > 500) {
        chunks.push({
          text: currentChunk.join('\n'),
          start: startLine,
          end: i + 1
        })
        currentChunk = []
        startLine = i + 2
      }
    })

    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n'),
        start: startLine,
        end: lines.length
      })
    }

    return chunks
  }
}
