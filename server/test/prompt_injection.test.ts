import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app, manager } from '../src/server'

// Ensure we use real modules
vi.unmock('fs/promises')
vi.unmock('child_process')
vi.unmock('../src/git.js')
vi.unmock('../src/opencode.js')

describe('Prompt Injection Integration Tests', () => {
  vi.setConfig({ testTimeout: 30000 })

  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-test-prompt-'))
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}')
  })

  afterAll(async () => {
    manager.shutdown()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should inject agent and model from session metadata', async () => {
    // 1. Connect
    const connectRes = await request(app).post('/api/connect').send({ folder: tempDir })
    expect(connectRes.status).toBe(200)

    // 2. Create Session
    const createRes = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ title: 'Test Session' })
    expect(createRes.status).toBe(200)
    const sessionId = (createRes.body as { id: string }).id

    // 3. Set Metadata
    const patchRes = await request(app)
      .patch(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
      .send({ agent: 'test-agent', model: 'test/test-model' })
    expect(patchRes.status).toBe(200)

    // 4. Send Prompt (Real call, no spies)
    const promptRes = await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({ message: 'Hello' })

    expect(promptRes.status).toBe(500)

    // The SDK/Worker returns an error object because the input is invalid (missing parts, model type mismatch),
    // but it echoes back the data it received in `error.data`.
    // We use this to verify that our server injected the agent and model correctly.
    interface ErrorResponse {
      error?: {
        data?: {
          agent?: string
          model?: {
            modelID?: string
            providerID?: string
          }
        }
      }
    }
    const responseBody = promptRes.body as ErrorResponse

    // Check if we got the expected error structure echoing the data
    if (responseBody.error?.data) {
      expect(responseBody.error.data.agent).toBe('test-agent')
      expect(responseBody.error.data.model!.modelID).toBe('test-model')
      expect(responseBody.error.data.model!.providerID).toBe('test')
    } else {
      // If the SDK behavior changes and it succeeds, we might need to check elsewhere.
      // But for now, based on the observed behavior:
      throw new Error('Expected error response with echoed data, got: ' + JSON.stringify(responseBody))
    }
  })
})
