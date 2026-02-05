import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as scaffoldTools from '../src/packs/standard/scaffold/index'
import { WorkspaceRegistry } from '../src/services/workspaces/workspace.registry.js'

// Mocks
vi.mock('child_process', () => ({
    exec: vi.fn(),
    default: { exec: vi.fn() }
}))

vi.mock('util', async () => {
    return {
        promisify: () => vi.fn().mockResolvedValue({ stdout: 'done' }),
        default: {
            promisify: () => vi.fn().mockResolvedValue({ stdout: 'done' })
        }
    }
})

vi.mock('../src/services/workspaces/workspace.registry.js')
vi.mock('../src/services/templates/template.loader.js')

describe('Scaffold Pack', () => {
    
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should implement list_templates', () => {
        expect(scaffoldTools.list_templates).toBeDefined()
    })

    it('should implement scaffold_project', () => {
        expect(scaffoldTools.scaffold_project).toBeDefined()
    })

    it('scaffold_project should clone monorepo', async () => {
        await scaffoldTools.scaffold_project({ template: 'monorepo', path: '/tmp/new-repo' })
        
        expect(WorkspaceRegistry.registerWorkspace).toHaveBeenCalledWith('/tmp/new-repo')
    })
})
