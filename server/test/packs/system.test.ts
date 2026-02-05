import { describe, it, expect, vi } from 'vitest'
import { shell_exec, system_open, system_notify } from '../../src/packs/standard/system/index.js'
import { exec } from 'child_process'
import * as os from 'os'

// Mocking child_process
vi.mock('child_process', () => {
  const execMock = vi.fn()
  return {
    exec: execMock,
    default: { exec: execMock }
  }
})

// Mocking os
vi.mock('os', () => {
  return {
    platform: vi.fn()
  }
})

describe('Pack: System', () => {
  it('shell_exec should run command and return stdout', async () => {
    // When mocking exec without the custom promisify symbol, promisify returns the first arg.
    // So we pass the object { stdout, stderr } as the first success argument.
    vi.mocked(exec).mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'output', stderr: '' })
      return {} as any
    })

    const result = await shell_exec({ command: 'echo hello' })
    expect(exec).toHaveBeenCalledWith('echo hello', expect.any(Function))
    expect(result).toBe('output')
  })

  it('system_open should use correct command for macOS', async () => {
    vi.mocked(os.platform).mockReturnValue('darwin')

    vi.mocked(exec).mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'done', stderr: '' })
      return {} as any
    })

    await system_open({ target: 'file.txt' })
    expect(exec).toHaveBeenCalledWith('open "file.txt"', expect.any(Function))
  })

  it('system_notify should use osascript on macOS', async () => {
    vi.mocked(os.platform).mockReturnValue('darwin')

    vi.mocked(exec).mockImplementation((cmd: any, cb: any) => {
      cb(null, { stdout: 'done', stderr: '' })
      return {} as any
    })

    await system_notify({ message: 'Hello' })
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('osascript -e \'display notification "Hello"'),
      expect.any(Function)
    )
  })
})
