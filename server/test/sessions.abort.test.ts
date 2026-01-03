import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/server.js'

// This test exercises aborting a running session against a real opencode instance.
// It will start a session, send a prompt to trigger an agent run, then call the abort endpoint
// and assert that the session reflects an aborted message or stops running.

describe('Session Abort Integration Test', () => {
  let tempDir: string
  let sessionId: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-test-session-abort-'))
    // Ensure manager is available and connected for this folder by hitting the connect endpoint
    await request(app).post('/api/connect').send({ folder: tempDir })
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    // Do not shutdown the shared manager here; other tests rely on it
  })

  it('should abort a running session', async () => {
    // Create session
    const createRes = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ title: 'Abort Test' })
    expect(createRes.status).toBe(200)
    const maybeId = (createRes.body as { id?: string }).id
    sessionId = maybeId ?? ''
    expect(sessionId).toBeTruthy()

    // Start a prompt that is likely to run for a short time. We use a long prompt to increase
    // the chance the agent starts work before we abort. Note: This depends on available models/providers.
    const promptRes = await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [
          {
            type: 'text',
            text: 'Please think step by step and take some time to reason about this: write out 200 tokens about software design patterns.'
          }
        ],
        model: 'test/test-model'
      })

    // prompt may be accepted (202/200) depending on SDK; we don't assert here
    expect([200, 202].includes(promptRes.status)).toBe(true)

    // Give it a short moment to start
    await new Promise((r) => setTimeout(r, 1500))

    // Call abort endpoint
    const abortRes = await request(app)
      .post(`/api/sessions/${sessionId}/abort?folder=${encodeURIComponent(tempDir)}`)
      .send()
    expect(abortRes.status).toBe(200)

    // Poll session messages to determine that the session is no longer actively producing assistant parts
    const sdkPollTimeout = 60000 // ms
    const pollInterval = 1000
    const start = Date.now()
    let stopped = false

    while (Date.now() - start < sdkPollTimeout) {
      const getRes = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
      expect(getRes.status).toBe(200)
      const body = getRes.body as { history?: unknown[] }

      // Consider session stopped if there are no assistant messages missing a completed timestamp
      let hasRunningAssistant = false
      if (Array.isArray(body.history)) {
        for (const m of body.history) {
          const msg = m as { info?: { role?: string; time?: { completed?: number } }; parts?: unknown[] }
          if (msg.info?.role === 'assistant' && !(msg.info.time && typeof msg.info.time.completed === 'number')) {
            hasRunningAssistant = true
            break
          }
        }
      }

      if (!hasRunningAssistant) {
        stopped = true
        break
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }

    expect(stopped).toBe(true)
  }, 120000)
})
