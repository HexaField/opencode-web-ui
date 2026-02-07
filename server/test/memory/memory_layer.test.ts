import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { SessionManager } from '../../src/services/memory/session-manager.js'
import { LearningService } from '../../src/services/memory/learning.service.js'
import { AppPaths } from '../../src/config.js'

// Mock fs to avoid writing to real disk during unit tests
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises')
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn()
  }
})

describe('SessionManager', () => {
  let sessionManager: SessionManager

  beforeEach(() => {
    sessionManager = new SessionManager()
    vi.clearAllMocks()
    vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' }) // Default: file not found
    vi.mocked(fs.readdir).mockResolvedValue([])
  })

  it('should create a new session file if not exists', async () => {
    await sessionManager.createSession('test-session')

    expect(fs.mkdir).toHaveBeenCalledWith(path.join(AppPaths.memory, 'sessions'), { recursive: true })
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('test-session.jsonl'), '', 'utf8')
  })

  it('should append message to session file', async () => {
    const msg = { role: 'user' as const, content: 'hello', timestamp: 'now' }
    await sessionManager.appendMessage('test-session', msg)

    expect(fs.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('test-session.jsonl'),
      JSON.stringify(msg) + '\n',
      'utf8'
    )
  })
})

describe('LearningService', () => {
  let learningService: LearningService

  beforeEach(() => {
    learningService = new LearningService()
    vi.clearAllMocks()
  })

  it('should record failure to failures.md', async () => {
    await learningService.recordFailure('ctx', 'err')

    expect(fs.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('failures.md'),
      expect.stringContaining('## Failure'),
      'utf8'
    )
  })

  it('should record lesson to LEARNED.md', async () => {
    await learningService.recordLesson('trigger', 'lesson')

    expect(fs.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('LEARNED.md'),
      expect.stringContaining('## Lesson'),
      'utf8'
    )
  })
})
