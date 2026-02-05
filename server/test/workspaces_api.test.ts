import request from 'supertest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../src/server.js'
import { WorkspaceRegistry } from '../src/services/workspaces/workspace.registry.js'
import { TemplateLoader } from '../src/services/templates/template.loader.js'
import * as scaffoldPack from '../src/packs/standard/scaffold/index.js'

// Mock dependencies
vi.mock('../src/services/workspaces/workspace.registry.js')
vi.mock('../src/services/templates/template.loader.js')
vi.mock('../src/packs/standard/scaffold/index.js')

describe('Workspaces API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/workspaces', () => {
    it('should return list of workspaces', async () => {
      const mockWorkspaces = [{ path: '/tmp/p1', name: 'p1', lastOpened: '2023-01-01', tags: [] }]
      vi.mocked(WorkspaceRegistry.getWorkspaces).mockResolvedValue(mockWorkspaces)

      const res = await request(app).get('/api/workspaces')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ workspaces: mockWorkspaces })
    })
  })

  describe('GET /api/templates', () => {
    it('should return list of templates', async () => {
      const mockTemplates = ['monorepo', 'basic']
      vi.mocked(TemplateLoader.listTemplates).mockResolvedValue(mockTemplates)

      const res = await request(app).get('/api/templates')

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ templates: mockTemplates })
    })
  })

  describe('POST /api/workspaces', () => {
    it('should scaffold a new project', async () => {
      vi.mocked(scaffoldPack.scaffold_project).mockResolvedValue('Success')

      const payload = { template: 'monorepo', path: '/tmp/new-project' }
      const res = await request(app).post('/api/workspaces').send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toEqual({ success: true, message: 'Success', path: payload.path })
      expect(scaffoldPack.scaffold_project).toHaveBeenCalledWith(payload)
    })

    it('should handle scaffold errors', async () => {
      vi.mocked(scaffoldPack.scaffold_project).mockRejectedValue(new Error('Failed'))

      const payload = { template: 'monorepo', path: '/tmp/fail' }
      const res = await request(app).post('/api/workspaces').send(payload)

      expect(res.status).toBe(500)
      expect(res.body).toMatchObject({ error: 'Failed' })
    })
  })
})
