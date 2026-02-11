import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mocks
const dbMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  transaction: vi.fn((fn) => fn),
  exec: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn()
}))

vi.mock('../../src/services/memory/db', () => ({
  DatabaseService: {
    getInstance: () => ({
      db: {
        prepare: dbMocks.prepare,
        transaction: dbMocks.transaction,
        exec: dbMocks.exec
      }
    })
  }
}))

const fsMocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn()
}))

vi.mock('fs/promises', () => ({
  default: {
    readdir: fsMocks.readdir,
    stat: fsMocks.stat,
    readFile: fsMocks.readFile
  },
  // Vitest sometimes mocks named exports inconsistently, so explicit helps
  readdir: fsMocks.readdir,
  stat: fsMocks.stat,
  readFile: fsMocks.readFile
}))

const embedMocks = vi.hoisted(() => ({
  embed: vi.fn()
}))

vi.mock('../../src/services/rag/embedding.service', () => ({
  EmbeddingService: class {
    static getInstance() {
      return new this()
    }
    async embed(text: string) {
      return embedMocks.embed(text)
    }
  }
}))

// Import SUT
import { IndexerService } from '../../src/services/rag/indexer.service'

describe('IndexerService (Phase 1)', () => {
  let indexer: IndexerService

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default mocks
    dbMocks.prepare.mockReturnValue({
      run: dbMocks.run,
      all: dbMocks.all,
      get: dbMocks.get
    })

    // Mock specific DB queries
    // 1. SELECT * FROM files -> return empty initially
    dbMocks.all.mockReturnValue([])
    // 2. SELECT id -> Return a fake ID
    dbMocks.get.mockReturnValue({ id: 123 })

    indexer = new IndexerService('/mock/memory')
  })

  it('should index a new file', async () => {
    // Setup FS
    // when withFileTypes: true, returns Dirent[]
    fsMocks.readdir.mockResolvedValue([{ name: 'journal.md', isDirectory: () => false }])
    fsMocks.stat.mockResolvedValue({ mtimeMs: 1000 })
    fsMocks.readFile.mockResolvedValue('Running on empty.')

    // Setup Embedder
    embedMocks.embed.mockResolvedValue(new Float32Array([0.1, 0.2]))

    await indexer.sync()

    // Expect DB insert into files
    // We verify the SQL statement passed to prepare contains 'INSERT INTO files'
    const prepareCalls = dbMocks.prepare.mock.calls.map((c) => c[0])
    expect(prepareCalls.some((sql) => sql.includes('INSERT INTO files'))).toBe(true)

    // Expect DB insert into chunks
    expect(prepareCalls.some((sql) => sql.includes('INSERT INTO chunks'))).toBe(true)

    // Expect Embedder to be called
    expect(embedMocks.embed).toHaveBeenCalledWith('Running on empty.')
  })
})
