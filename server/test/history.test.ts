import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app } from '../src/server'

// Mock the Opencode SDK
const { mockClient } = vi.hoisted(() => {
  return {
    mockClient: {
      session: {
        create: vi.fn(),
        fork: vi.fn(),
        prompt: vi.fn(),
        get: vi.fn(),
        messages: vi.fn(),
        update: vi.fn(),
        list: vi.fn()
      },
      event: {
        subscribe: vi.fn()
      }
    }
  }
})

vi.mock('../src/opencode', () => {
  return {
    OpencodeManager: class {
      connect = vi.fn().mockResolvedValue(mockClient)
      getClient = vi.fn().mockResolvedValue(mockClient)
      getSessionMetadata = vi.fn().mockResolvedValue({})
      saveSessionMetadata = vi.fn().mockResolvedValue(undefined)
      getAllSessionMetadata = vi.fn().mockResolvedValue({})
    }
  }
})

describe('Session History (Recursive Fetch)', () => {
  const folder = '/tmp/test-project'

  beforeAll(() => {
    // Setup initial mocks
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  it('should recursively fetch history from parent session and slice at revert point', async () => {
    const parentId = 'session-parent'
    const childId = 'session-child'
    const limitMsgId = 'msg-2'

    // Mock responses for Fresh Fork
    mockClient.session.get.mockImplementation(async ({ path }) => {
      if (path.id === parentId) {
        return { data: { id: parentId, version: '1.0' } }
      }
      if (path.id === childId) {
        return {
          data: {
            id: childId,
            version: '1.0',
            parentID: parentId,
            revert: { messageID: limitMsgId } // Child has revert pointing to parent msg
          }
        }
      }
      return { error: 'Not found' }
    })

    mockClient.session.messages.mockImplementation(async ({ path }) => {
      if (path.id === parentId) {
        return {
          data: [
            { info: { id: 'msg-1', time: { created: 100 } } },
            { info: { id: 'msg-2', time: { created: 200 } } },
            { info: { id: 'msg-3', time: { created: 300 } } }
          ]
        }
      }
      if (path.id === childId) {
        return {
          data: []
        }
      }
      return { data: [] }
    })

    const res = await request(app).get(`/api/sessions/${childId}?folder=${encodeURIComponent(folder)}`)

    expect(res.status).toBe(200)
    const history = res.body.history
    expect(Array.isArray(history)).toBe(true)

    // Logic: Combined [1, 2, 3]. Revert at 2. Result [1, 2].
    expect(history.map((m: any) => m.info.id)).toEqual(['msg-1', 'msg-2'])
  })

  it('should include new messages and exclude future parent messages', async () => {
    const parentId = 'session-parent'
    const childId = 'session-child-prompted'
    const forkPoint = 'msg-2'

    // Mock Child: Revert persists to indicate fork point
    mockClient.session.get.mockImplementation(async ({ path }) => {
      if (path.id === parentId) return { data: { id: parentId, version: '1.0' } }
      if (path.id === childId) {
        return {
          data: {
            id: childId,
            version: '1.0',
            parentID: parentId,
            revert: { messageID: forkPoint }
          }
        }
      }
      return { error: 'Not found' }
    })

    mockClient.session.messages.mockImplementation(async ({ path }) => {
      if (path.id === parentId) {
        return {
          data: [
            { info: { id: 'msg-1', time: { created: 100 } } },
            { info: { id: 'msg-2', time: { created: 200 } } },
            { info: { id: 'msg-3', time: { created: 300 } } } // Future message in parent
          ]
        }
      }
      if (path.id === childId) {
        return {
          data: [
            { info: { id: 'msg-4', time: { created: 400 } } } // New message in child
          ]
        }
      }
      return { data: [] }
    })

    const res = await request(app).get(`/api/sessions/${childId}?folder=${encodeURIComponent(folder)}`)
    const history = res.body.history

    // Expect msg-3 to be gone (sliced from parent)
    // Expect msg-4 to be present (kept from child)
    expect(history.map((m: any) => m.info.id)).toEqual(['msg-1', 'msg-2', 'msg-4'])
  })

  it('should handle local revert (revert within same session)', async () => {
    const sessionId = 'session-local-revert'
    const limitMsgId = 'msg-local-1'

    // Mock Session: No parent, but has revert data
    mockClient.session.get.mockImplementation(async ({ path }) => {
      if (path.id === sessionId) {
        return {
          data: {
            id: sessionId,
            version: '1.0',
            revert: { messageID: limitMsgId }
          }
        }
      }
      return { error: 'Not found' }
    })

    // Mock Messages: Returns history BEYOND revert point
    mockClient.session.messages.mockImplementation(async ({ path }) => {
      if (path.id === sessionId) {
        return {
          data: [
            { info: { id: 'msg-local-1', time: { created: 100 } } },
            { info: { id: 'msg-local-2', time: { created: 200 } } } // Should be sliced
          ]
        }
      }
      return { data: [] }
    })

    const res = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(folder)}`)
    const history = res.body.history

    expect(history.map((m: any) => m.info.id)).toEqual(['msg-local-1'])
  })
})
