import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'
import { app, agent, manager } from './server.js'
import { setupTerminalService } from './services/terminal/terminal.service.js'
import { InitService } from './services/init.service.js'

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

const port = process.env.SERVER_PORT || process.env.PORT || 3001
const host = process.env.SERVER_HOST || '0.0.0.0'

async function bootstrap() {
  console.log('Bootstrapping Personal OS...')

  // Initialize Agent Subsystems
  await InitService.init()

  agent.start()

  const keyPath = path.join(process.cwd(), 'server/certs/server.key')
  const certPath = path.join(process.cwd(), 'server/certs/server.crt')

  let server

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
    server = https.createServer(options, app).listen(Number(port), host, () => {
      console.log(`Server running on https://${host}:${port}`)
      if (process.send) process.send('ready')
    })
  } else {
    server = app.listen(Number(port), host, () => {
      console.log(`Server running on http://${host}:${port}`)
      if (process.send) process.send('ready')
    })
  }

  setupTerminalService(server)

  server.on('error', (err) => {
    console.error('Server failed to start:', err)
    process.exit(1)
  })

  // Graceful Shutdown
  const shutdown = async () => {
    console.log('Shutting down server...')

    // 1. Stop accepting new connections immediately
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.')
      })
      // Close all open connections associated with the server
      server.closeAllConnections?.()
    }

    // 2. Stop Agent Loop
    agent.stop()

    // 3. Clean up Worker Processes
    await manager.shutdown()

    console.log('Cleanup complete via shutdown handler.')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err)
  process.exit(1)
})
