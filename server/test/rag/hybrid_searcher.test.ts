import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HybridSearcher } from '../../src/services/rag/hybrid_searcher'
import { EmbeddingService } from '../../src/services/rag/embedding.service'

import Database from 'better-sqlite3'

// 1. Setup DB Mocks
const mocks = vi.hoisted(() => {
  return {
    prepare: vi.fn(),
    all: vi.fn(),
    close: vi.fn()
  }
})

vi.mock('better-sqlite3', () => {
  return {
    default: class {
      constructor() {
        return {
          prepare: mocks.prepare,
          close: mocks.close
        }
      }
    }
  }
})

// 2. Mock EmbeddingService
const embeddingMocks = vi.hoisted(() => {
  return {
    embed: vi.fn()
  }
})

vi.mock('../../src/services/rag/embedding.service', () => {
  return {
    EmbeddingService: {
      getInstance: () => ({
        embed: embeddingMocks.embed
      })
    }
  }
})

describe('HybridSearcher', () => {
  let searcher: HybridSearcher
  let dbMock: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    dbMock = new Database(':memory:')

    // Default Mock Implementation for `prepare`
    mocks.prepare.mockImplementation((sql: string) => {
      return {
        all: (...args: any[]) => {
          if (sql.includes('SELECT rowid')) {
            // FTS Query Response
            return [{ rowid: 10 }, { rowid: 20 }]
          }
          if (sql.includes('SELECT id, embedding FROM chunks')) {
            // Vector Scan Response
            const vecA = new Float32Array([1.0, 0.0])
            const vecB = new Float32Array([0.0, 1.0])
            // Note: better-sqlite3 returns Blobs/Buffers for BLOB columns
            const buffA = Buffer.from(vecA.buffer)
            const buffB = Buffer.from(vecB.buffer)

            return [
              { id: 10, embedding: buffA },
              { id: 20, embedding: buffB }
            ]
          }
          if (sql.includes('SELECT c.id, c.content')) {
            // Hydration
            return [
              { id: 10, content: 'Doc A Content', path: 'a.md', start_line: 1, end_line: 5 },
              { id: 20, content: 'Doc B Content', path: 'b.md', start_line: 1, end_line: 5 }
            ]
          }
          return []
        }
      }
    })

    searcher = new HybridSearcher(dbMock)
  })

  it('should combine results using RRF', async () => {
    // Query "test"
    // Mock Embed: [1.0, 0.0] -> Matches Doc 10 perfectly.
    embeddingMocks.embed.mockResolvedValue(new Float32Array([1.0, 0.0]))

    const results = await searcher.search('test')

    expect(results.length).toBe(2)
    expect(results[0].id).toBe(10)
    expect(results[1].id).toBe(20)
    expect(results[0].score).toBeGreaterThan(results[1].score)

    expect(mocks.prepare).toHaveBeenCalledTimes(3) // FTS, Vector, Hydrate
  })

  it('should prioritise vector matches if FTS misses', async () => {
    embeddingMocks.embed.mockResolvedValue(new Float32Array([0.0, 1.0])) // Valid match for Doc 20 (Simulated)

    mocks.prepare.mockImplementation((sql: string) => {
      return {
        all: () => {
          if (sql.includes('chunks_fts')) return [] // FTS finds nothing
          if (sql.includes('chunks WHERE embedding')) {
            const vecA = new Float32Array([1.0, 0.0])
            const vecB = new Float32Array([0.0, 1.0])
            return [
              { id: 10, embedding: Buffer.from(vecA.buffer) },
              { id: 20, embedding: Buffer.from(vecB.buffer) }
            ]
          }
          if (sql.includes('SELECT c.id')) {
            return [{ id: 20, content: 'Doc B', path: 'b.md' }]
          }
          return []
        }
      }
    })

    const results = await searcher.search('concept', { useFts: true, useVectors: true })

    expect(results.length).toBe(1)
    expect(results[0].id).toBe(20)
  })
})
