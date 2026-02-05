import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs/promises'
import { fs_read_file, fs_write_file, fs_list_dir } from '../../src/packs/core/fs/index.js'

// Mocking fs
vi.mock('fs/promises', async () => {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  }
})

describe('Core Pack: FS', () => {
  it('fs_read_file should call fs.readFile', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('content')
    const result = await fs_read_file({ path: '/tmp/test.txt' })
    expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.txt', 'utf8')
    expect(result).toBe('content')
  })

  it('fs_write_file should call fs.writeFile', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue()
    await fs_write_file({ path: '/tmp/test.txt', content: 'hello' })
    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/test.txt', 'hello', 'utf8')
  })

  it('fs_list_dir should join files', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['a.txt', 'b.txt'] as any)
    const result = await fs_list_dir({ path: '/tmp' })
    expect(result).toBe('a.txt\nb.txt')
  })
})
