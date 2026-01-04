import { spawn, type ChildProcess } from 'child_process'

let serverProcess: ChildProcess | undefined

export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  // Start opencode server on random port
  // We use 'opencode' assuming it's in the PATH (which it seems to be)
  serverProcess = spawn('opencode', ['serve', '--port', '0'], {
    stdio: 'pipe',
    shell: true
  })

  const url = await new Promise<string>((resolve, reject) => {
    let buffer = ''
    const onData = (data: Buffer) => {
      buffer += data.toString()
      const match = buffer.match(/listening on (http:\/\/[^\s]+)/)
      if (match) {
        resolve(match[1])
        cleanup()
      }
    }

    const onError = (err: Error) => {
      reject(err)
      cleanup()
    }

    const onExit = (code: number) => {
      if (code !== 0) {
        reject(new Error(`Opencode server exited with code ${code}`))
      }
      cleanup()
    }

    const cleanup = () => {
      serverProcess?.stdout?.off('data', onData)
      serverProcess?.off('error', onError)
      serverProcess?.off('exit', onExit)
    }

    serverProcess?.stdout?.on('data', onData)
    serverProcess?.on('error', onError)
    serverProcess?.on('exit', onExit)
  })

  console.log(`Global Opencode server started at ${url}`)
  provide('opencodeUrl', url)
}

export async function teardown() {
  if (serverProcess) {
    serverProcess.kill()
  }
  await Promise.resolve()
}
