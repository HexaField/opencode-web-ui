
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'path'
import { ContextLoader } from '../../src/services/memory/context_loader'
import { AppPaths } from '../../src/config'

const mocks = vi.hoisted(() => {
    return {
        readFile: vi.fn()
    }
})

vi.mock('fs/promises', () => {
    return {
        default: {
            readFile: mocks.readFile
        },
        readFile: mocks.readFile
    }
})

describe('ContextLoader', () => {
    const mockMemoryPath = '/mock/memory'
    
    // We mock AppPaths to point to our test location
    // Since AppPaths is an object, we can't easily reassign properties if they are consts 
    // but we can rely on fs mocks to intercept calls to whatever path is constructed.
    // However, AppPaths is imported from config. Test file paths are usually absolute.
    // Let's just mock the values passed to ContextLoader or spy on fs.

    beforeEach(() => {
        vi.resetAllMocks()
    })

    describe('loadPrinciples', () => {
        it('should return default principles if file not found', async () => {
             // @ts-ignore
             mocks.readFile.mockRejectedValue({ code: 'ENOENT' })
             
             const principles = await ContextLoader.loadPrinciples()
             expect(principles).toContain('User Centricity')
             expect(principles).toContain('Determinism First')
        })
    })

    describe('loadMemoryMd', () => {
        it('should load MEMORY.md content', async () => {
            const mockContent = '# My Identity\nI am a coder.'
            // @ts-ignore
            mocks.readFile.mockResolvedValue(mockContent)

            const content = await ContextLoader.loadMemoryMd()
            
            expect(mocks.readFile).toHaveBeenCalledWith(path.join(AppPaths.memory, 'MEMORY.md'), 'utf-8')
            expect(content).toBe(mockContent)
        })

        it('should return generic instruction if MEMORY.md missing', async () => {
            // @ts-ignore
            mocks.readFile.mockRejectedValue({ code: 'ENOENT' })

            const content = await ContextLoader.loadMemoryMd()
            expect(content).toContain('No MEMORY.md found')
        })
    })

    describe('loadRecentJournals', () => {
        it('should load yesterday and today journals', async () => {
            const today = new Date().toISOString().split('T')[0]
            const yesterdayDate = new Date()
            yesterdayDate.setDate(yesterdayDate.getDate() - 1)
            const yesterday = yesterdayDate.toISOString().split('T')[0]

            // Mock implementation to return different content based on path
            // @ts-ignore
            mocks.readFile.mockImplementation(async (fpath) => {
                if (typeof fpath === 'string') {
                    if (fpath.includes(today)) return 'Today Log'
                    if (fpath.includes(yesterday)) return 'Yesterday Log'
                }
                throw { code: 'ENOENT' }
            })

            const context = await ContextLoader.loadRecentJournals()
            
            expect(context).toContain(`## Journal (${yesterday})`)
            expect(context).toContain('Yesterday Log')
            expect(context).toContain(`## Journal (${today})`)
            expect(context).toContain('Today Log')
        })
        
        it('should handle missing journals gracefully', async () => {
            // @ts-ignore
            mocks.readFile.mockRejectedValue({ code: 'ENOENT' })

            const context = await ContextLoader.loadRecentJournals()
            expect(context).toContain('No entry')
        })
    })
})
