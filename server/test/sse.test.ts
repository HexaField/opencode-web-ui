import { exec } from 'child_process'
import * as fs from 'fs/promises'
import { IncomingMessage } from 'http'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app, manager } from '../src/server.js'

const execAsync = promisify(exec)

// Ensure we use real modules
vi.unmock('fs/promises')
vi.unmock('child_process')
vi.unmock('../src/git.js')
vi.unmock('../src/opencode.js')

describe('SSE Integration Tests', () => {
  vi.setConfig({ testTimeout: 30000 })

  let tempDir: string
  let sessionId: string

  beforeAll(async () => {
    // Create a temp dir for the "project"
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-sse-test-'))
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}')

    // Initialize git repo (needed for some operations)
    await execAsync('git init', { cwd: tempDir })
    await execAsync('git config user.email "test@example.com"', { cwd: tempDir })
    await execAsync('git config user.name "Test User"', { cwd: tempDir })
    await execAsync('git add .', { cwd: tempDir })
    await execAsync('git commit -m "Initial commit"', { cwd: tempDir })

    // Connect
    await request(app).post('/api/connect').send({ folder: tempDir })

    // Create a session
    const res = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ body: { title: 'SSE Test Session' } })

    sessionId = (res.body as { id: string }).id
  })

  afterAll(async () => {
    manager.shutdown()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should establish an SSE connection and receive initial data', async () => {
    let receivedData = ''

    await new Promise<void>((resolve, reject) => {
      const req = request(app)
        .get(`/api/sessions/${sessionId}/events?folder=${encodeURIComponent(tempDir)}`)
        .buffer(false)
        .parse((res, _callback) => {
          void _callback
          const nodeRes = res as unknown as IncomingMessage
          nodeRes.setEncoding('utf8')
          nodeRes.on('data', (chunk) => {
            receivedData += chunk
            if (receivedData.includes('data: {')) {
              // We got data, we can stop
              nodeRes.destroy()
              resolve()
            }
          })
          res.on('end', () => {
            resolve()
          })
        })

      // Trigger the request
      req.end((err: Error) => {
        if (err) reject(err)
      })
    })

    expect(receivedData).toContain('data: {')
    expect(receivedData).toContain(`"id":"${sessionId}"`)
  })
})
