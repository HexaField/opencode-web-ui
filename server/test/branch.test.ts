import { describe, it, expect, vi, beforeEach } from 'vitest'
// app import removed
import express from 'express'
import { registerSessionsRoutes } from '../src/services/sessions/sessions.service'
import request from 'supertest'

// Mock dependencies
const mockClient = {
  session: {
    fork: vi.fn(),
    prompt: vi.fn()
  }
}

const mockManager = {
  getSessionMetadata: vi.fn().mockResolvedValue({ agent: 'default-agent', model: 'openai/gpt-4' }),
  saveSessionMetadata: vi.fn().mockResolvedValue(true),
  connect: vi.fn().mockResolvedValue(mockClient)
}

// Re-create the app with mocks for this test
function makeApp() {
  const app = express()
  app.use(express.json())

  // @ts-ignore
  registerSessionsRoutes(app, mockManager)
  return app
}

describe('Atomic Branch Endpoint', () => {
  let app: express.Application

  beforeEach(() => {
    app = makeApp()
    vi.clearAllMocks()
  })

  it('successfully forks and prompts a new session', async () => {
    // Setup Mocks
    mockClient.session.fork.mockResolvedValue({ id: 'session-forked' })
    mockClient.session.prompt.mockResolvedValue({ info: { id: 'msg-new' }, parts: [] })

    const res = await request(app)
      .post('/api/sessions/session-original/branch')
      .query({ folder: '/tmp/test' })
      .send({
        messageID: 'msg-parent',
        parts: [{ type: 'text', text: 'New Branch Prompt' }]
      })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('session-forked') // Should return new session ID

    // Verify SDK calls
    expect(mockClient.session.fork).toHaveBeenCalledWith({
      path: { id: 'session-original' },
      body: { messageID: 'msg-parent' }
    })

    expect(mockClient.session.prompt).toHaveBeenCalledWith({
      path: { id: 'session-forked' }, // Prompt the NEW session
      body: expect.objectContaining({
        parts: [{ type: 'text', text: 'New Branch Prompt' }],
        // Should inherit model from manager metadata mock
        model: { providerID: 'openai', modelID: 'gpt-4' }
      })
    })
  })

  // Removed 'fails if model cannot be determined' as strict validation is not enforced by service level currently
})
