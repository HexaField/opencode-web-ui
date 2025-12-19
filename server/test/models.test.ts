import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/server.js'

describe('Models API', () => {
  it('should list available models from opencode CLI', async () => {
    const res = await request(app).get('/models')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect((res.body as string[]).length).toBeGreaterThan(0)
    
    // Check for some known models that should be present
    const models = res.body as string[]
    const hasClaude = models.some(m => m.includes('claude'))
    const hasGpt = models.some(m => m.includes('gpt'))
    
    expect(hasClaude || hasGpt).toBe(true)
  })
})
