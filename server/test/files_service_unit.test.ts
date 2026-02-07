import request from 'supertest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { app, manager } from '../src/server.js'
import * as fs from 'fs/promises'
import fg from 'fast-glob'
import * as cp from 'child_process'

// Mock dependencies
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
}))

vi.mock('fast-glob', () => ({
    default: vi.fn()
}))

vi.mock('child_process', () => {
    const exec = vi.fn((cmd, opts, cb) => {
        if (typeof opts === 'function') {
            cb = opts
        }
        // Default success callback
        if (cb) cb(null, { stdout: '', stderr: '' })
        return {}
    })
    const execFile = vi.fn((cmd, args, opts, cb) => {
         if (typeof opts === 'function') {
            cb = opts
        }
        if (cb) cb(null, { stdout: '', stderr: '' })
        return {}
    })
    const spawn = vi.fn(() => ({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
    }))

    return {
        exec,
        execFile,
        spawn,
        default: { exec, execFile, spawn }
    }
})

describe('Files Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('GET /api/files/read', () => {
        it('should pass folder as directory to client.file.read', async () => {
            const mockFileRead = vi.fn().mockResolvedValue({ content: 'fake content' })
            const mockClient = {
                file: {
                    read: mockFileRead,
                    status: vi.fn(),
                }
            }
            vi.spyOn(manager, 'connect').mockResolvedValue(mockClient as any)

            const folder = '/tmp/test-project'
            const filePath = 'src/index.ts'
            
            const res = await request(app)
                .get('/api/files/read')
                .query({ folder, path: filePath })

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ content: 'fake content' })
            expect(mockFileRead).toHaveBeenCalledWith({
                query: {
                    path: filePath,
                    directory: folder 
                }
            })
        })

        it('should fallback to fs.readFile if SDK returns unknown format', async () => {
            const mockFileRead = vi.fn().mockResolvedValue({ some: 'data' }) // No content property
            const mockClient = { file: { read: mockFileRead } }
            vi.spyOn(manager, 'connect').mockResolvedValue(mockClient as any)
            
            // Mock fs.readFile for fallback
            vi.mocked(fs.readFile).mockResolvedValue('fs content')

            const res = await request(app)
                .get('/api/files/read')
                .query({ folder: '/tmp', path: 'test.txt' })

            expect(res.body).toEqual({ content: 'fs content' })
            expect(fs.readFile).toHaveBeenCalled()
        })
    })

    describe('POST /api/fs/search', () => {
        it('should search files using fast-glob and regex', async () => {
            // Mock fast-glob
            vi.mocked(fg).mockResolvedValue(['/tmp/project/file1.ts', '/tmp/project/file2.ts'])
            
            // Mock fs.readFile
            vi.mocked(fs.readFile).mockImplementation(async (path) => {
                if (path === '/tmp/project/file1.ts') return 'const x = 1;'
                if (path === '/tmp/project/file2.ts') return 'const y = 2;'
                return ''
            })

            const res = await request(app).post('/api/fs/search').send({
                folder: '/tmp/project',
                query: 'const x'
            })

            expect(res.status).toBe(200)
            expect(res.body.results).toHaveLength(1)
            expect(res.body.results[0].fileName).toBe('file1.ts')
            expect(res.body.results[0].matches[0].matchText).toBe('const x')
        })

        it('should respect .gitignore if enabled', async () => {
            vi.mocked(fs.readFile).mockImplementation(async (path) => {
                if (String(path).endsWith('.gitignore')) return 'node_modules\n*.log'
                return 'content'
            })
            vi.mocked(fg).mockResolvedValue([])

            await request(app).post('/api/fs/search').send({
                folder: '/tmp/project',
                query: 'foo',
                useGitIgnore: true
            })

            expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('.gitignore'), 'utf-8')
            expect(fg).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    ignore: expect.arrayContaining(['**/node_modules', '**/*.log'])
                })
            )
        })
    })

    describe('GET /api/files/status', () => {
        it('should return file status from client', async () => {
            const mockStatus = { modified: ['a.txt'], staged: [] }
            const mockClient = { file: { status: vi.fn().mockResolvedValue(mockStatus) } }
            vi.spyOn(manager, 'connect').mockResolvedValue(mockClient as any)

            const res = await request(app)
                .get('/api/files/status')
                .query({ folder: '/tmp' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual(mockStatus)
        })
    })

    describe('GET /api/fs/list', () => {
        it('should list files and directories', async () => {
            const mockEntries = [
                { name: 'file.txt', isDirectory: () => false },
                { name: 'src', isDirectory: () => true }
            ]
            vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any)

            const res = await request(app)
                .get('/api/fs/list')
                .query({ path: '/tmp' })

            expect(res.status).toBe(200)
            // Expect directories sorted first
            expect(res.body[0].name).toBe('src')
            expect(res.body[0].isDirectory).toBe(true)
            expect(res.body[1].name).toBe('file.txt')
        })
    })

    describe('GET /api/fs/read', () => {
        it('should read file content from fs', async () => {
            vi.mocked(fs.readFile).mockResolvedValue('content')
            
            const res = await request(app)
                .get('/api/fs/read')
                .query({ path: '/tmp/a.txt' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ content: 'content' })
            expect(fs.readFile).toHaveBeenCalledWith('/tmp/a.txt', 'utf-8')
        })
    })

    describe('POST /api/fs/write', () => {
        it('should write content to file', async () => {
            vi.mocked(fs.writeFile).mockResolvedValue(undefined)

            const res = await request(app).post('/api/fs/write').send({
                path: '/tmp/a.txt',
                content: 'new content'
            })

            expect(res.status).toBe(200)
            expect(fs.writeFile).toHaveBeenCalledWith('/tmp/a.txt', 'new content', 'utf-8')
        })
    })

    describe('POST /api/fs/delete', () => {
        it('should delete file', async () => {
            vi.mocked(fs.rm).mockResolvedValue(undefined)

            const res = await request(app).post('/api/fs/delete').send({
                path: '/tmp/a.txt'
            })

            expect(res.status).toBe(200)
            expect(fs.rm).toHaveBeenCalledWith('/tmp/a.txt', { recursive: true, force: true })
        })
    })

    describe('GET /api/files/diff', () => {
        it('should return git diff for tracked file', async () => {
            // Mock exec for tracked file
            vi.mocked(cp.exec).mockImplementation(((cmd: string, opts: any, cb: any) => {
                if (typeof opts === 'function') { cb = opts; opts = {} }
                
                if (cmd.includes('git status --porcelain')) {
                    cb(null, { stdout: ' M file.txt', stderr: '' })
                } else if (cmd.includes('git diff HEAD')) {
                    cb(null, { stdout: 'diff content', stderr: '' })
                } else {
                    cb(null, { stdout: '', stderr: '' })
                }
                return {} as any
            }) as any)

            const res = await request(app)
                .get('/api/files/diff')
                .query({ folder: '/tmp', path: 'file.txt' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ diff: 'diff content' })
        })

        it('should return isNew for untracked file', async () => {
             vi.mocked(cp.exec).mockImplementation(((cmd: string, opts: any, cb: any) => {
                if (typeof opts === 'function') { cb = opts; opts = {} }
                
                if (cmd.includes('git status --porcelain')) {
                    cb(null, { stdout: '?? newfile.txt', stderr: '' })
                } else if (cmd.includes('git diff --no-index')) {
                    // git diff --no-index returns 1 on diff
                    const err = new Error('Command failed') as any
                    err.code = 1
                    err.stdout = 'new file diff'
                    cb(err, { stdout: 'new file diff', stderr: '' })
                } else {
                    cb(null, { stdout: '', stderr: '' })
                }
                return {} as any
            }) as any)

            const res = await request(app)
                .get('/api/files/diff')
                .query({ folder: '/tmp', path: 'newfile.txt' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ diff: 'new file diff', isNew: true })
        })
    })

    describe('GET /api/files/diff-summary', () => {
        it('should return diff summary', async () => {
             vi.mocked(cp.exec).mockImplementation(((cmd: string, opts: any, cb: any) => {
                if (typeof opts === 'function') { cb = opts; opts = {} }
                
                if (cmd.includes('shortstat')) {
                    cb(null, { stdout: ' 1 file changed, 2 insertions(+), 1 deletion(-)' })
                } else if (cmd.includes('numstat')) {
                    cb(null, { stdout: '2\t1\tfile.txt\n' })
                }
                return {} as any
            }) as any)

            const res = await request(app)
                .get('/api/files/diff-summary')
                .query({ folder: '/tmp' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual({
                filesChanged: 1,
                added: 2,
                removed: 1,
                details: [{ path: 'file.txt', added: 2, removed: 1 }]
            })
        })
    })
})
