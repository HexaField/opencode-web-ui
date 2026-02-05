import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkspaceRegistry } from '../src/services/workspaces/workspace.registry'
import * as fs from 'fs/promises'
import { AppPaths } from '../src/config.js'

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn()
}))

describe('WorkspaceRegistry', () => {
    
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('should initialize workspaces.json if missing', async () => {
        // Mock access to throw (file not found)
        vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
        
        await WorkspaceRegistry.init()
        
        expect(fs.writeFile).toHaveBeenCalledWith(
            AppPaths.workspaces,
            JSON.stringify({ workspaces: [] }, null, 2),
            'utf-8'
        )
    })

    it('should register a new workspace', async () => {
        // Mock reading empty list
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ workspaces: [] }))
        
        await WorkspaceRegistry.registerWorkspace('/tmp/project')

        expect(fs.writeFile).toHaveBeenCalled()
        const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
        const data = JSON.parse(writeCall[1] as string)
        
        expect(data.workspaces).toHaveLength(1)
        expect(data.workspaces[0]).toMatchObject({
            path: '/tmp/project',
            name: 'project'
        })
    })

    it('should update lastOpened for existing workspace', async () => {
        const existing = [
            { path: '/tmp/project', name: 'project', lastOpened: 'old-date', tags: [] }
        ]
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ workspaces: existing }))

        await WorkspaceRegistry.registerWorkspace('/tmp/project')

        const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
        const data = JSON.parse(writeCall[1] as string)
        
        expect(data.workspaces).toHaveLength(1)
        expect(data.workspaces[0].lastOpened).not.toBe('old-date')
    })
})
