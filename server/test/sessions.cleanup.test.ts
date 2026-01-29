import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/server.js'

describe('Session Cleanup Integration Test', () => {
  let tempDir: string
  let sessionId: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-test-session-cleanup-'))
    // Connect to the folder
    await request(app).post('/api/connect').send({ folder: tempDir })
  })

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should permanently remove hidden messages after a new prompt', async () => {
    // 1. Create Session
    const createRes = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ title: 'Cleanup Test' })
    expect(createRes.status).toBe(200)
    sessionId = (createRes.body as { id: string }).id

    // 2. add Message A
    await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [{ type: 'text', text: 'Message A' }],
        model: 'test/test-model'
      })
    await new Promise((r) => setTimeout(r, 1000))

    // 3. add Message B
    await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [{ type: 'text', text: 'Message B' }],
        model: 'test/test-model'
      })
    await new Promise((r) => setTimeout(r, 2000))

    // Get history
    const historyRes = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
    const history = (historyRes.body as { history: any[] }).history
    console.log(
      'History Before Revert:',
      JSON.stringify(history.map((m) => ({ id: m.info.id, text: m.parts?.[0]?.text })))
    )

    // We need at least 2 messages to revert one and keep one.
    expect(history.length).toBeGreaterThanOrEqual(2)

    // Pick a message that is NOT the last one.
    // If we have [A, A_Reply, B, B_Reply], revert to A_Reply.
    // If we have [A, B], revert to A.
    const revertIndex = Math.floor(history.length / 2) - 1 // Start roughly in middle or early
    const safeRevertIndex = revertIndex < 0 ? 0 : revertIndex

    // Ensure we are dropping at least one message
    expect(history.length - 1).toBeGreaterThan(safeRevertIndex)

    const messageToRevertTo = history[safeRevertIndex]
    const messageToRevertToId = messageToRevertTo.info.id
    const droppedMessageId = history[history.length - 1].info.id // The last one will definitely be dropped

    // 4. Revert
    await request(app)
      .post(`/api/sessions/${sessionId}/revert?folder=${encodeURIComponent(tempDir)}`)
      .send({ messageID: messageToRevertToId })

    // Verify truncated
    const historyAfterRevertRes = await request(app).get(
      `/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`
    )
    const historyAfterRevert = (historyAfterRevertRes.body as { history: any[] }).history
    expect(historyAfterRevert.length).toBe(safeRevertIndex + 1)

    // 5. Send new Prompt C
    await request(app)
      .post(`/api/sessions/${sessionId}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [{ type: 'text', text: 'Message C' }],
        model: 'test/test-model'
      })
    await new Promise((r) => setTimeout(r, 1000))

    // 6. Verify Cleanup
    // We check that we cannot UNREVERT to retrieve `droppedMessageId`.
    // OR we check raw history if possible. But we access via API.
    // The API `unrevert` should fail or do nothing meaningful if cleanup happened.

    // Try to unrevert
    await request(app)
      .post(`/api/sessions/${sessionId}/unrevert?folder=${encodeURIComponent(tempDir)}`)
      .send()

    const finalHistoryRes = await request(app).get(`/api/sessions/${sessionId}?folder=${encodeURIComponent(tempDir)}`)
    const finalHistory = (finalHistoryRes.body as { history: any[] }).history
    const finalIds = finalHistory.map((m: any) => m.info.id)

    expect(finalIds).not.toContain(droppedMessageId)
    // Should contain C
    const finalContent = JSON.stringify(finalHistory)
    expect(finalContent).toContain('Message C')
  }, 60000)
})
