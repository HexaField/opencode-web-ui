import { IncomingMessage, Server } from 'http'
import { Server as HttpsServer } from 'https'
import * as pty from 'node-pty'
import * as os from 'os'
import { Duplex } from 'stream'
import { WebSocket, WebSocketServer } from 'ws'

export function setupTerminalService(server: Server | HttpsServer) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`)

    if (url.pathname === '/api/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
  })

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash')

    // Parse URL to get folder
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`)
    const folder = url.searchParams.get('folder') || process.cwd()

    // Create PTY
    let ptyProcess: pty.IPty

    try {
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: folder,
        env: process.env as Record<string, string>
      })
    } catch (e) {
      console.error('Failed to spawn PTY:', e)
      ws.close()
      return
    }

    // Read from PTY and send to WS
    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    ptyProcess.onExit(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })

    // Read from WS and write to PTY
    ws.on('message', (message) => {
      const msg = Buffer.isBuffer(message) ? message.toString() : String(message)
      if (msg.startsWith('__resize__:')) {
        try {
          const dims = JSON.parse(msg.slice(11)) as { cols?: unknown; rows?: unknown }
          if (typeof dims.cols === 'number' && typeof dims.rows === 'number') {
            ptyProcess.resize(dims.cols, dims.rows)
          }
        } catch (e) {
          console.error('Invalid resize message', e)
        }
      } else {
        ptyProcess.write(msg)
      }
    })

    ws.on('close', () => {
      try {
        ptyProcess.kill()
      } catch {
        // ignore
      }
    })

    ws.on('error', () => {
      try {
        ptyProcess.kill()
      } catch {
        // ignore
      }
    })
  })
}
