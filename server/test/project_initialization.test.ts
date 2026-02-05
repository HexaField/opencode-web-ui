import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectInitializer } from '../src/services/workspaces/project.initializer'
import { WorkspaceRegistry } from '../src/services/workspaces/workspace.registry.js'
import * as fs from 'fs/promises'
import * as path from 'path'

vi.mock('fs/promises', () => ({
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn()
}))

vi.mock('../src/services/workspaces/workspace.registry.js')

describe('ProjectInitializer', () => {
    const mockCwd = '/tmp/my-project'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should do nothing if .pai/alignment.md exists', async () => {
        vi.mocked(fs.access).mockResolvedValue(undefined) // File exists

        await ProjectInitializer.ensureInitialized(mockCwd)

        expect(fs.writeFile).not.toHaveBeenCalled()
    })

    it('should initialize project if .pai/alignment.md is missing', async () => {
        // 1. .pai/alignment.md missing
        vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'))
        
        // 2. Mock reading package.json
        vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
            if (filePath.toString().endsWith('package.json')) {
                return JSON.stringify({ 
                    name: 'test-app', 
                    dependencies: { 'react': '^18.0.0', 'typescript': '^5.0.0' } 
                })
            }
            return ''
        })

        await ProjectInitializer.ensureInitialized(mockCwd)

        // Expect .pai folder creation
        expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockCwd, '.pai'), { recursive: true })

        // Expect alignment file creation
        expect(fs.writeFile).toHaveBeenCalled()
        const writeCall = vi.mocked(fs.writeFile).mock.calls[0]
        expect(writeCall[0]).toContain('.pai/alignment.md')
        // Newlines make strict containment tricky with indentation in template string
        expect(writeCall[1]).toContain('react, typescript') 

        // Expect WorkspaceRegistry update
        expect(WorkspaceRegistry.updateMetadata).toHaveBeenCalledWith(
            mockCwd, 
            expect.objectContaining({ techStack: ['react', 'typescript'] })
        )
    })
})
