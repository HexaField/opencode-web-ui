import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, manager } from '../src/server.js'

interface SessionResponse {
  id: string
  title: string
  agent: string
  model: string
  [key: string]: unknown
}

describe('Session Update Tests', () => {
  let tempDir: string
  let sessionId: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-test-session-update-'))
    // Create a dummy agent
    await request(app)
      .post(`/api/agents?folder=${encodeURIComponent(tempDir)}`)
      .send({ name: 'test-agent', content: 'Test Agent Content' })
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    manager.shutdown()
  })

  it('should create a session', async () => {
    const res = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ title: 'Test Session', agent: 'test-agent' })

    expect(res.status).toBe(200)
    const body = res.body as SessionResponse
    sessionId = body.id
    expect(sessionId).toBeDefined()
    console.log('Created session:', res.body)
  })

  it('should update session agent and model', async () => {
    const updateRes = await request(app)
      .patch(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
      .send({ agent: 'test-agent', model: 'gpt-4' })

    if (updateRes.status !== 200) {
      console.log('Update response:', updateRes.body)
    }
    expect(updateRes.status).toBe(200)

    // Verify update by fetching session
    const getRes = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)

    console.log('Get session:', JSON.stringify(getRes.body, null, 2))

    expect(getRes.status).toBe(200)
    const body = getRes.body as SessionResponse
    expect(body.agent).toBe('test-agent')
    expect(body.model).toBe('gpt-4')
  })
})
