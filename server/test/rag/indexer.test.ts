import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'path'
import * as fs from 'fs/promises'
import { IndexerService } from '../../src/services/rag/indexer.service'
import { VectorStore } from '../../src/services/rag/vector.store'
import { WorkspaceRegistry } from '../../src/services/workspaces/workspace.registry'

// 1. Mock transformers to avoid native binary issues
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn()
}))

// 2. Mock fs/promises completely
vi.mock('fs/promises', () => {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn()
  }
})

// 3. Mock dependencies
vi.mock('../../src/services/rag/vector.store')
vi.mock('../../src/services/workspaces/workspace.registry', () => ({
  WorkspaceRegistry: {
    getWorkspace: vi.fn()
  }
}))

describe('IndexerService', () => {
  let service: IndexerService
  let mockVectorStore: any
  const mockMemoryDir = '/mock/memory/path'

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup VectorStore mock instance
    mockVectorStore = new (VectorStore as any)()
    service = new IndexerService(mockVectorStore, mockMemoryDir)
  })

  it('should index contents of a workspace (README)', async () => {
    const workspacePath = '/mock/workspace'

    // Mock Registry
    vi.mocked(WorkspaceRegistry.getWorkspace).mockResolvedValue({
      path: workspacePath,
      name: 'test-ws',
      tags: [],
      lastOpened: new Date().toISOString()
    })

    // Mock FS
    vi.mocked(fs.readFile).mockImplementation(async (getPath) => {
      if (getPath.toString().endsWith('README.md')) {
        return '# Mock Readme Content\nThis is a long description of the project that should definitively be longer than 50 characters to pass the noise filter in the indexer service.'
      }
      return ''
    })

    await service.indexWorkspace(workspacePath)

    // Verify we tried to read the readme
    expect(fs.readFile).toHaveBeenCalledWith(path.join(workspacePath, 'README.md'), 'utf-8')

    // Then indexes the readme
    expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
      `readme:${workspacePath}`,
      expect.stringContaining('# Mock Readme Content'),
      expect.objectContaining({
        type: 'readme',
        workspace: 'test-ws'
      })
    )

    // Verify we added to vector store
    // It indexes the workspace metadata first
    expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
      `meta:${workspacePath}`,
      expect.stringContaining('Project test-ws'),
      expect.objectContaining({ type: 'meta' })
    )
  })

  it('should index memory files', async () => {
    // Mock readdir to find markdown files
    // @ts-ignore
    vi.mocked(fs.readdir).mockResolvedValue(['memory1.md', 'ignore.txt', 'memory2.md'])

    // Mock readFile
    vi.mocked(fs.readFile).mockImplementation(async (getPath) => {
      if (getPath.toString().endsWith('memory1.md')) return 'Memory One'
      if (getPath.toString().endsWith('memory2.md')) return 'Memory Two'
      return ''
    })

    await service.indexMemory()

    expect(fs.readdir).toHaveBeenCalledWith(mockMemoryDir)

    // Should have indexed both md files
    expect(mockVectorStore.addDocument).toHaveBeenCalledTimes(2)
    expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
      'memory:memory1.md',
      'Memory One',
      expect.objectContaining({ source: 'memory1.md', type: 'memory' })
    )
    expect(mockVectorStore.addDocument).toHaveBeenCalledWith(
      'memory:memory2.md',
      'Memory Two',
      expect.objectContaining({ source: 'memory2.md', type: 'memory' })
    )
  })
})
