import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, manager } from '../src/server.js'

describe('Search API', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-search-test-'))

    // Create test structure
    // file1.txt: "Hello World\nAnother Line with hello"
    // src/file2.ts: "const hello = 'world';"
    // src/utils.ts: "function test() { return 'hello'; }"
    // ignored.log: "Hello Ignored"

    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Hello World\nAnother Line with hello')
    await fs.writeFile(path.join(tempDir, 'foo.txt'), 'Foo Bar')
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'src', 'file2.ts'), "const hello = 'world';")
    await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), "function test() { return 'hello'; }")
    await fs.writeFile(path.join(tempDir, 'ignored.log'), 'Hello Ignored')
    // Add .gitignore
    await fs.writeFile(
      path.join(tempDir, '.gitignore'),
      `
# Comments
ignored.log
src/utils.ts
    `.trim()
    )
    // Wait for FS to settle
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  afterAll(async () => {
    manager.shutdown()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should search for text "Hello" case insensitive', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'Hello',
      folder: tempDir,
      isCaseSensitive: false
    })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('file1.txt')
    expect(files).toContain('src/file2.ts')
    expect(files).toContain('src/utils.ts')
    expect(files).toContain('ignored.log')

    // Check match details for file1.txt
    const file1Res = res.body.results.find((r: any) => r.fileName === 'file1.txt')
    expect(file1Res.matches).toHaveLength(2)
    expect(file1Res.matches[0].lineText).toContain('Hello World')
    expect(file1Res.matches[1].lineText).toContain('Another Line with hello')
  })

  it('should search for text "Hello" case sensitive', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'Hello',
      folder: tempDir,
      isCaseSensitive: true
    })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('file1.txt')
    expect(files).toContain('ignored.log')
    expect(files).not.toContain('src/file2.ts')
    expect(files).not.toContain('src/utils.ts')
  })

  it('should respect exclude patterns', async () => {
    const res = await request(app)
      .post('/api/fs/search')
      .send({
        query: 'Hello',
        folder: tempDir,
        isCaseSensitive: false,
        exclude: ['**/*.log']
      })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('file1.txt')
    expect(files).not.toContain('ignored.log')
  })

  it('should respect include patterns', async () => {
    const res = await request(app)
      .post('/api/fs/search')
      .send({
        query: 'Hello',
        folder: tempDir,
        isCaseSensitive: false,
        include: ['src/**/*.ts']
      })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('src/file2.ts')
    expect(files).toContain('src/utils.ts')
    expect(files).not.toContain('file1.txt')
  })

  it('should respect .gitignore when enabled', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'Hello',
      folder: tempDir,
      isCaseSensitive: false,
      useGitIgnore: true
    })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    // ignored.log should be ignored
    expect(files).not.toContain('ignored.log')
    // src/utils.ts should be ignored
    expect(files).not.toContain('src/utils.ts')
    // src/file2.ts should NOT be ignored
    expect(files).toContain('src/file2.ts')
    // file1.txt should NOT be ignored
    expect(files).toContain('file1.txt')
  })

  it('should match whole word', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'Hello',
      folder: tempDir,
      matchWholeWord: true,
      isCaseSensitive: false
    })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('file1.txt') // "Hello World"
    expect(files).toContain('src/file2.ts') // "hello" (case insensitive)

    // Create a file where "Hello" is part of another word
    await fs.writeFile(path.join(tempDir, 'partial.txt'), 'HelloThere')

    const resPartial = await request(app).post('/api/fs/search').send({
      query: 'Hello',
      folder: tempDir,
      matchWholeWord: true,
      isCaseSensitive: false
    })
    const filesPartial = resPartial.body.results.map((r: any) => r.fileName)
    expect(filesPartial).not.toContain('partial.txt')
  })

  it.skip('should search using regex', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'Hell[o]', // Regex for Hello
      folder: tempDir,
      isRegex: true,
      isCaseSensitive: false
    })

    expect(res.status).toBe(200)
    const files = res.body.results.map((r: any) => r.fileName)
    expect(files).toContain('file1.txt')
  })

  it('should handle invalid regex', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: '[', // Invalid regex
      folder: tempDir,
      isRegex: true
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid Regex')
  })

  it('should return error if folder or query is missing', async () => {
    const res = await request(app).post('/api/fs/search').send({
      query: 'foo'
    })
    expect(res.status).toBe(400)

    // const res2 = await request(app).post('/api/fs/search').send({
    //   folder: tempDir
    // })
    // expect(res2.status).toBe(400)
  })
})
