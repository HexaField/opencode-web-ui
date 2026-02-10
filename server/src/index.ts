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
    agent.stop()
    
    // Allow manager to clean up workers
    await manager.shutdown()
    
    if (server) {
      server.close(() => {
        console.log('HTTP server closed.')
        process.exit(0)
      })
      
      // Force exit if server.close hangs
      setTimeout(() => { 
        console.error('Forcing exit after timeout')
        process.exit(1) 
      }, 5000).unref()
    } else {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err)
  process.exit(1)
})
