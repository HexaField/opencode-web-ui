import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(),
      all: vi.fn(),
      get: vi.fn()
    })),
    pragma: vi.fn(),
    close: vi.fn()
  }
})

vi.mock('better-sqlite3', () => {
  return {
    default: class {
      constructor() {
        return {
          exec: mocks.exec,
          prepare: mocks.prepare,
          pragma: mocks.pragma,
          close: mocks.close
        }
      }
    }
  }
})

import { DatabaseService } from '../../src/services/memory/db'

describe('Memory Schema Phase 1 (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    DatabaseService.resetInstance()
  })

  it('should initialize with the correct Schema', () => {
    DatabaseService.getInstance()

    expect(mocks.exec).toHaveBeenCalled()
    const sqlCalls = mocks.exec.mock.calls.map((c) => c[0]).join('\n')

    // Verify NEW schemas are present
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS files')
    expect(sqlCalls).toContain('CREATE TABLE IF NOT EXISTS chunks')
    expect(sqlCalls).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts')

    // Ensure correctness of schema
    expect(sqlCalls).toContain('FOREIGN KEY(file_id) REFERENCES files(id)')
  })
})
