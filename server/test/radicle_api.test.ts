import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerGitRoutes } from '../src/services/git/git.service'
import { radicleService } from '../src/radicle'

// Mock the radicle service singleton
vi.mock('../src/radicle', () => ({
  radicleService: {
    isRepo: vi.fn(),
    initRepo: vi.fn()
  }
}))

// Mock git module used by git service
vi.mock('../src/git', () => ({
  findGitRepositories: vi.fn(),
  getGitStatus: vi.fn(),
  getCurrentBranch: vi.fn(),
  getAheadBehind: vi.fn(),
  runGitCommand: vi.fn()
}))

// Mock middleware
vi.mock('../src/middleware', () => ({
  validate: () => (_req: any, _res: any, next: any) => next()
}))

describe('Radicle API Integration', () => {
  let app: express.Application

  beforeEach(() => {
    app = express()
    app.use(express.json())
    registerGitRoutes(app)
    vi.clearAllMocks()
  })

  describe('GET /api/git/radicle/status', () => {
    it('should return isRepo: true when radicleService.isRepo returns true', async () => {
      vi.mocked(radicleService.isRepo).mockResolvedValue(true)

      const res = await request(app).get('/api/git/radicle/status?folder=/test/folder')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ isRepo: true })
      expect(radicleService.isRepo).toHaveBeenCalledWith('/test/folder')
    })

    it('should return isRepo: false when radicleService.isRepo returns false', async () => {
      vi.mocked(radicleService.isRepo).mockResolvedValue(false)

      const res = await request(app).get('/api/git/radicle/status?folder=/test/folder')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ isRepo: false })
    })

    it('should return 400 if folder is missing', async () => {
      const res = await request(app).get('/api/git/radicle/status')
      expect(res.status).toBe(400)
    })

    it('should return 500 if service throws', async () => {
      vi.mocked(radicleService.isRepo).mockRejectedValue(new Error('Service error'))

      const res = await request(app).get('/api/git/radicle/status?folder=/test/folder')

      expect(res.status).toBe(500)
    })
  })

  describe('POST /api/git/radicle/init', () => {
    it('should call initRepo and return success', async () => {
      vi.mocked(radicleService.initRepo).mockResolvedValue(undefined)

      const res = await request(app).post('/api/git/radicle/init').send({ folder: '/test/folder' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
      expect(radicleService.initRepo).toHaveBeenCalledWith('/test/folder')
    })

    it('should return 400 if folder is missing', async () => {
      const res = await request(app).post('/api/git/radicle/init').send({})

      expect(res.status).toBe(400)
    })

    it('should return 500 if init fails', async () => {
      vi.mocked(radicleService.initRepo).mockRejectedValue(new Error('Init failed'))

      const res = await request(app).post('/api/git/radicle/init').send({ folder: '/test/folder' })

      expect(res.status).toBe(500)
    })
  })
})
