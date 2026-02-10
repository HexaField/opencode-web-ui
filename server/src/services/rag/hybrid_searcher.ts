import Database from 'better-sqlite3'
import { EmbeddingService } from './embedding.service.js'

export interface SearchResult {
  id: number
  content: string
  filePath: string
  startLine: number
  endLine: number
  score: number
}

interface VectorEntry {
  id: number
  embedding: Float32Array
}

export class HybridSearcher {
  private cache: VectorEntry[] | null = null
  private lastCacheUpdate = 0
  private CACHE_TTL = 60 * 1000 // 1 minute

  constructor(private db: Database.Database) {}

  /**
   * Performs a hybrid search using FTS5 keywords and Vector cosine similarity.
   * Uses Reciprocal Rank Fusion (RRF) to combine results.
   */
  async search(
    query: string,
    options: { limit?: number; useFts?: boolean; useVectors?: boolean } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 5
    const useFts = options.useFts ?? true
    const useVectors = options.useVectors ?? true

    // Parallel execution for FTS and Vector search
    const [ftsResults, vectorResults] = await Promise.all([
      useFts ? this.searchFts(query, limit * 2) : Promise.resolve([]),
      useVectors ? this.searchVectors(query, limit * 2) : Promise.resolve([])
    ])

    // RRF Merge
    const scores = new Map<number, number>()
    const k = 60 // RRF constant

    // Process FTS ranks
    ftsResults.forEach((id, index) => {
      const rank = index + 1
      const score = 1 / (k + rank)
      scores.set(id, (scores.get(id) || 0) + score)
    })

    // Process Vector ranks
    vectorResults.forEach((item, index) => {
        // If we are only using vectors, we might want to use the raw similarity score
        // But for hybrid, rank is more stable.
        // Let's stick to RRF for consistency in hybrid mode.
      const rank = index + 1
      const score = 1 / (k + rank)
      scores.set(item.id, (scores.get(item.id) || 0) + score)
    })

    // If only one method was used, we might want to preserve the original sort
    // But RRF is monotonic so sorting by RRF score preserves rank order of the single source.
    
    // exception: valid vector search might return 0 results if cache empty? No, scan returns all.
    
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]) // Descending score
      .slice(0, limit)
      .map(([id]) => id)

    if (sortedIds.length === 0) return []

    return this.hydrateResults(sortedIds, scores)
  }

  private async searchFts(query: string, limit: number): Promise<number[]> {
    try {
      // Simple FTS query. Note: FTS5 syntax rules apply (OR, AND, quotes).
      // We might want to sanitize the query or use 'NEAR'.
      // For now, simpler is better: treat as phrase or bag of words.
      
      const statement = this.db.prepare(`
        SELECT rowid 
        FROM chunks_fts 
        WHERE chunks_fts MATCH ? 
        ORDER BY rank 
        LIMIT ?
      `)
      
      // Wrapping in quotes for phrase search or simple sanitation
      // "path/to/file" chars might break it. 
      // Let's attempt a raw query but fall back if it fails?
      // A safer bet for general text is sanitation.
      const sanitized = query.replace(/"/g, '""')
      const ftsQuery = `"${sanitized}"` // Phrase search preferred? Or `term1 OR term2`?
      // Let's stick to phrase for strong keyword matches, or natural language if unquoted?
      // Just passing the raw string often fails in FTS5 if it has symbols.
      // Let's try standard sanitization.
      
      const rows = statement.all(ftsQuery, limit) as { rowid: number }[]
      return rows.map((r) => r.rowid)
    } catch (err) {
      console.warn('FTS Search failed (likely syntax):', err)
      return [] // Fallback to vector only
    }
  }

  private async searchVectors(query: string, limit: number): Promise<{ id: number; score: number }[]> {
    const vector = await EmbeddingService.getInstance().embed(query)
    if (!vector) {
        console.warn('Embedding generation failed')
        return []
    }

    const vectors = await this.getVectors()
    console.log(`Searching ${vectors.length} vectors`)
    
    // Compute Cosine Similarity
    // TODO: move to optimized loop or WASM if slow. JS loop is fine for <100k.
    const results = vectors.map((v) => {
      const score = this.cosineSimilarity(vector, v.embedding)
      return { id: v.id, score }
    })

    // Sort descending
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  private async getVectors(): Promise<VectorEntry[]> {
    const now = Date.now()
    if (this.cache && (now - this.lastCacheUpdate < this.CACHE_TTL)) {
      return this.cache
    }

    const statement = this.db.prepare('SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL')
    const rows = statement.all() as { id: number; embedding: Buffer }[]
    
    this.cache = rows.map(r => ({
      id: r.id,
      embedding: new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)
    }))
    this.lastCacheUpdate = now
    return this.cache
  }

  private hydrateResults(ids: number[], scores: Map<number, number>): SearchResult[] {
    const placeholders = ids.map(() => '?').join(',')
    const stmt = this.db.prepare(`
      SELECT c.id, c.content, c.start_line, c.end_line, f.path
      FROM chunks c
      JOIN files f ON c.file_id = f.id
      WHERE c.id IN (${placeholders})
    `)
    
    const rows = stmt.all(...ids) as any[]
    
    // Map back to guarantee order and attach score
    return ids.map((id) => {
      const row = rows.find((r) => r.id === id)
      if (!row) return null
      return {
        id: row.id,
        content: row.content,
        filePath: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: scores.get(id) || 0
      }
    }).filter((r): r is SearchResult => r !== null)
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    // Check for zero vectors
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
