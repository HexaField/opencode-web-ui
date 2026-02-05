import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/server'

describe('Agents API', () => {
    it('GET /api/agents/status returns agent status', async () => {
        const response = await request(app).get('/api/agents/status')
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('status')
        // Starts as idle
        expect(response.body.status).toBe('idle')
    })
    
    it('GET /api/agents/memory returns lessons', async () => {
        const response = await request(app).get('/api/agents/memory')
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('lessons')
    })
})
