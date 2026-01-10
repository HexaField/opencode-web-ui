import * as pty from 'node-pty'
import * as os from 'os'
import { describe, expect, it } from 'vitest'

describe('Terminal Service (node-pty)', () => {
  it('should spawn a pty process successfully', () => {
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash')

    console.log(`Node Platform: ${process.platform}`)
    console.log(`OS Platform: ${os.platform()}`)
    console.log(`Shell resolved to: ${shell}`)
    console.log(`CWD: ${process.cwd()}`)

    expect(() => {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env as Record<string, string>
      })

      ptyProcess.kill()
    }).not.toThrow()
  })

  it('should be able to write and read from pty', async () => {
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash')
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>
    })

    const output = await new Promise<string>((resolve) => {
      let buffer = ''
      ptyProcess.onData((data) => {
        buffer += data
        if (buffer.includes('hello_test_world')) {
          resolve(buffer)
        }
      })

      // Use a slight delay to let shell start
      setTimeout(() => {
        ptyProcess.write('echo hello_test_world\r')
      }, 100)
    })

    expect(output).toContain('hello_test_world')
    ptyProcess.kill()
  })
})
