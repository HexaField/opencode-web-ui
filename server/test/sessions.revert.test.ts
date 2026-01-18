import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/server.js'

describe('Session Revert Integration Test', () => {
  let tempDir: string
  let sessionId: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-test-session-revert-'))
    // Connect to the folder
    await request(app).post('/api/connect').send({ folder: tempDir })
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should revert and unrevert a message', async () => {
    // 1. Create Session
    const createRes = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ title: 'Revert Test' })
    expect(createRes.status).toBe(200)
    sessionId = (createRes.body as { id: string }).id

    // 2. Prompt (Create a message)
    const promptRes = await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [{ type: 'text', text: 'Hello' }],
        model: 'test/test-model'
      })
    expect(promptRes.status).toBeOneOf([200, 202])

    // Wait for the message to appear in history
    await new Promise((r) => setTimeout(r, 2000))

    // Get history to find the message ID
    const historyRes = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
    const history = (historyRes.body as { history: any[] }).history
    // Expect at least 2 messages (user + assistant)
    expect(history.length).toBeGreaterThanOrEqual(1)
    const lastMessageId = history[history.length - 1].info.id
    const initialHistoryLength = history.length

    // 3. Revert the last message
    // We send messageID in body
    const revertRes = await request(app)
      .post(`/api/sessions/${sessionId}/revert?folder=${encodeURIComponent(tempDir)}`)
      .send({ messageID: lastMessageId })

    // NOTE: If the endpoint is not implemented, this will 404
    expect(revertRes.status).toBe(200)

    // Check history length decreased or the message is marked reverted (SDK specific)
    // Assuming revert removes it from active history or similar.
    const historyAfterRevertRes = await request(app).get(
      `/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`
    )
    const historyAfterRevert = (historyAfterRevertRes.body as { history: any[] }).history

    // The history should be shorter now
    expect(historyAfterRevert.length).toBeLessThan(initialHistoryLength)
    // The specific message ID should no longer be in the array
    const idsAfter = historyAfterRevert.map((m: any) => m.info.id)
    expect(idsAfter).not.toContain(lastMessageId)

    // 4. Unrevert
    const unrevertRes = await request(app)
      .post(`/api/sessions/${sessionId}/unrevert?folder=${encodeURIComponent(tempDir)}`)
      .send()
    expect(unrevertRes.status).toBe(200)

    // Check history length restored
    const historyAfterUnrevertRes = await request(app).get(
      `/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`
    )
    const historyAfterUnrevert = (historyAfterUnrevertRes.body as { history: any[] }).history

    expect(historyAfterUnrevert.length).toBe(initialHistoryLength)
    const idsAfterUnrevert = historyAfterUnrevert.map((m: any) => m.info.id)
    expect(idsAfterUnrevert).toContain(lastMessageId)
  }, 60000)
})
