import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { app, manager } from '../src/server.js'

vi.unmock('fs/promises')

describe('Workflow Bug Reproduction', () => {
  vi.setConfig({ testTimeout: 30000 })
  let tempDir: string

  const mockStorage: Record<string, any[]> = {}

  // Track agent calls to verify sequence
  const callSequence: string[] = []

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repro-workflow-'))
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}')

    vi.spyOn(manager, 'connect').mockImplementation(async (_folder) => {
      const sessionStore: Record<string, any> = {}
      const status: Record<string, string> = {}

      return {
        session: {
          create: async (params: any) => {
            const id = `ses_${Date.now()}`
            sessionStore[id] = { id, ...params.body }
            return { id }
          },
          get: async (params: any) => {
            return sessionStore[params.path.id]
          },
          status: async (params: any) => {
            const s = status[params.path.id] || 'idle'
            return { [params.path.id]: { type: s } }
          },
          messages: async (params: any) => {
            const id = params.path.id
            return mockStorage[id] || []
          },
          prompt: async (params: any) => {
            const id = params.path.id
            const agent = params.body.agent
            const text = params.body.parts[0].text

            if (!mockStorage[id]) mockStorage[id] = []

            // Add User Prompt
            const userMsgId = `msg_u_${Date.now()}`
            mockStorage[id].push({
              id: userMsgId,
              info: { role: 'user', time: { created: Date.now() } },
              parts: params.body.parts
            })

            status[id] = 'busy'

            // Analyze prompt to determine who is acting
            let responseText = '{}'

            if (agent === 'plan') {
              if (text.includes('Analyze the context and produce a PRD')) {
                callSequence.push('architect-prd')
                responseText = JSON.stringify({ prd: 'PRD Content' })
              } else if (text.includes('Produce an ADR')) {
                callSequence.push('architect-adr')
                responseText = JSON.stringify({ adr: 'ADR Content' })
              } else if (text.includes('Produce a Phased Implementation Plan')) {
                callSequence.push('architect-plan')
                responseText = JSON.stringify({ phases: [{ title: 'Phase 1' }] })
              } else if (text.includes('Current Phase Index:')) {
                callSequence.push('manager')
                // Check if we already did Phase 1?
                const phaseIndex = callSequence.filter((x) => x === 'manager').length - 1

                if (phaseIndex === 0) {
                  responseText = JSON.stringify({
                    phaseIndex: 0,
                    phaseTitle: 'Phase 1',
                    instructions: 'Implement logic',
                    isFinished: false
                  })
                } else {
                  responseText = JSON.stringify({
                    phaseIndex: 1,
                    isFinished: true // Stop after 1 round
                  })
                }
              } else if (text.includes('Review the implementation for completeness')) {
                callSequence.push('reviewer')
                responseText = JSON.stringify({ completeness: 'Good', signoff: true })
              }
            } else if (agent === 'worker') {
              callSequence.push('worker')
              responseText = JSON.stringify({ status: 'done', work: 'Implemented logic' })
            } else if (agent === 'verifier') {
              callSequence.push('verifier')
              responseText = JSON.stringify({ verdict: 'approve' })
            } else if (agent === 'build') {
              // Orchestrator dummy
              responseText = 'Workflow Started: comprehensive-workflow'
            } else if (text.includes('Review the implementation for completeness')) {
              callSequence.push('reviewer')
              responseText = JSON.stringify({ completeness: 'Good', signoff: true })
            }

            // Respond after delay
            setTimeout(() => {
              const assistantMsgId = `msg_a_${Date.now()}`
              mockStorage[id].push({
                id: assistantMsgId,
                info: { role: 'assistant', time: { created: Date.now() + 100 } },
                parts: [{ type: 'text', text: responseText }]
              })
              status[id] = 'idle'
            }, 100)

            return {}
          }
        }
      } as any
    })
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should run the full sequence: architect -> manager -> worker -> verifier', async () => {
    // 1. Create Session
    const resId = await request(app)
      .post(`/api/sessions?folder=${encodeURIComponent(tempDir)}`)
      .send({ agent: 'comprehensive-workflow' })
      .expect(200)

    const id = resId.body.id
    expect(id).toBeDefined()

    // 2. Prompt (Trigger Workflow)
    await request(app)
      .post(`/api/sessions/${id}/prompt?folder=${encodeURIComponent(tempDir)}`)
      .send({
        parts: [{ type: 'text', text: 'Do the task' }],
        model: 'openai/gpt-4'
      })
      .expect(200)

    // 3. Wait for sequence
    // Sequence Logic:
    // - Orchestrator (immediate response)
    // - Architect (bootstrap)
    // - Manager (round 1 start)
    // - Worker (round 1 step 2)
    // - Verifier (round 1 step 3)
    // - Manager (round 2 start -> finish)

    // Poll for completion
    // We will wait up to 30 seconds
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500))
      if (callSequence.includes('reviewer')) break
    }

    console.log('Call Sequence:', callSequence)

    expect(callSequence).toContain('architect-prd')
    expect(callSequence).toContain('architect-adr')
    expect(callSequence).toContain('architect-plan')
    expect(callSequence).toContain('manager')
    expect(callSequence).toContain('worker')
    expect(callSequence).toContain('verifier')
    expect(callSequence).toContain('reviewer')

    // Order matters
    const prdIdx = callSequence.indexOf('architect-prd')
    const adrIdx = callSequence.indexOf('architect-adr')
    const planIdx = callSequence.indexOf('architect-plan')

    expect(prdIdx).toBeLessThan(adrIdx)
    expect(adrIdx).toBeLessThan(planIdx)
    expect(planIdx).toBeLessThan(callSequence.indexOf('manager'))

    const mgrIdx = callSequence.indexOf('manager')
    const wkrIdx = callSequence.indexOf('worker')
    const vrfIdx = callSequence.indexOf('verifier')

    expect(mgrIdx).toBeLessThan(wkrIdx) // In round 1
    expect(wkrIdx).toBeLessThan(vrfIdx) // Worker before Verifier
  })
})
