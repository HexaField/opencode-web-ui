import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateLoader } from '../src/services/templates/template.loader.js'
import * as fs from 'fs/promises'
import { AppPaths } from '../src/config.js'

vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn()
}))

describe('TemplateLoader', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('should list available templates', async () => {
        vi.mocked(fs.readdir).mockResolvedValue(['t1', 't2'] as any)
        
        const templates = await TemplateLoader.listTemplates()
        expect(templates).toContain('t1')
        expect(templates).toContain('t2')
        expect(templates).toContain('monorepo') // Verified defaults
    })

    it('should return monorepo as a default template', async () => {
        vi.mocked(fs.readdir).mockResolvedValue([] as any)
        const templates = await TemplateLoader.listTemplates()
        expect(templates).toContain('monorepo')
    })
})
