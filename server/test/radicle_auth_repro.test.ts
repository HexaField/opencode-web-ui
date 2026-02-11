import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as child_process from 'child_process'

// Mock child_process
vi.mock('child_process', () => {
  const exec = vi.fn()
  const execFile = vi.fn()
  return {
    exec,
    execFile,
    default: {
      exec,
      execFile
    }
  }
})

// Import service after mocking
import { radicleService } from '../src/radicle'

describe('Radicle Auth Failure Repro (Mocked)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv }
    // @ts-ignore - access private method or property if needed, but setPassphrase is public
    radicleService.setPassphrase('') // Reset cached passphrase
  })

  it('should fail to create a task when auth is missing and recover with passphrase', async () => {
    const folder = '/tmp/fake-rad-repo'

    // Mock `rad .` to succeed so isRepo returns true
    // @ts-ignore
    vi.mocked(child_process.exec).mockImplementation((cmd, options, callback) => {
      // @ts-ignore
      if (typeof options === 'function') {
        callback = options
        options = {}
      }
      const cb = callback as any
      if (typeof cmd === 'string' && cmd.startsWith('rad .')) {
        cb(null, { stdout: 'z123fakeRid', stderr: '' } as any)
      } else {
        cb(null, { stdout: '', stderr: '' } as any)
      }
      return {} as any
    })

    // Mock `rad issue open` to fail if no passphrase
    // @ts-ignore
    vi.mocked(child_process.execFile).mockImplementation((file, args, options, callback) => {
      // @ts-ignore
      if (typeof options === 'function') {
        callback = options
        options = {}
      }
      const cb = callback as any

      // Check passphrase from env OR options (which radicleService injects)
      const envPass = options?.env?.RAD_PASSPHRASE || process.env.RAD_PASSPHRASE

      if (file === 'rad' && Array.isArray(args) && args.includes('issue') && args.includes('open')) {
        if (!envPass) {
          const err = new Error('Command failed') as any
          err.code = 1
          err.stderr = 'Permissions denied (publickey). Passphrase required.'
          err.stdout = ''
          cb(err, { stdout: '', stderr: err.stderr } as any)
          return {} as any
        }
      }
      // Success case
      cb(null, { stdout: 'Issue z123456 created', stderr: '' } as any)
      return {} as any
    })

    // Ensure RAD_PASSPHRASE is missing in env
    delete process.env.RAD_PASSPHRASE

    // Should fail initially
    await expect(
      radicleService.createTask(folder, {
        title: 'Fail Task',
        description: 'Should fail'
      })
    ).rejects.toThrow(/Radicle authentication failed/)

    // Now set passphrase
    radicleService.setPassphrase('my-secret-pass')

    // Should succeed now
    const task = await radicleService.createTask(folder, {
      title: 'Success Task',
      description: 'Should succeed'
    })
    expect(task.id).toBe('z123456')
  })
})
