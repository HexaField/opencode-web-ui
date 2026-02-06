import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import * as fs from 'fs/promises'
import * as http from 'http'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { OpencodeManager } from './opencode.js'
import { PersonalAgent } from './agent/PersonalAgent.js'
import { registerAgentsRoutes } from './services/agents/agents.service.js'
import { registerFilesRoutes } from './services/files/files.service.js'
import { registerGitRoutes } from './services/git/git.service.js'
import { registerMiscRoutes } from './services/misc/misc.service.js'
import { registerSessionsRoutes } from './services/sessions/sessions.service.js'
import { registerTasksRoutes } from './services/tasks/tasks.service.js'
import { registerWorkspacesRoutes } from './services/workspaces/workspaces.service.js'
import { registerRagRoutes } from './services/rag/rag.routes.js'
import { registerReflectionRoutes } from './services/reflection/reflection.routes.js'
import { ReflectionListener } from './services/reflection/reflection.listener.js'

export const app = express()
app.use(cors())
app.use(bodyParser.json())

export const manager = new OpencodeManager()
export const agent = new PersonalAgent(manager)

// Listeners
const reflectionListener = new ReflectionListener(manager)
reflectionListener.register()

// Register routes
registerMiscRoutes(app, manager)
registerSessionsRoutes(app, manager)
registerAgentsRoutes(app, manager, agent)
registerFilesRoutes(app, manager)
registerGitRoutes(app)
registerTasksRoutes(app)
registerWorkspacesRoutes(app)
registerRagRoutes(app)
registerReflectionRoutes(app, manager)

// Serve static files
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '../../dist')

app.use(express.static(distPath))

// SPA fallback
app.get(/(.*)/, async (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  if (process.env.NODE_ENV === 'development') {
    const clientPort = process.env.CLIENT_PORT || 5173
    const clientHost = process.env.CLIENT_HOST || '127.0.0.1'

    const options = {
      hostname: clientHost,
      port: clientPort,
      path: req.url,
      method: req.method,
      headers: req.headers
    }

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    })

    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e)
      res.status(502).send('Bad Gateway')
    })

    req.pipe(proxyReq, { end: true })
    return
  }

  const indexHtml = path.join(distPath, 'index.html')
  try {
    await fs.access(indexHtml)
    res.sendFile(indexHtml)
  } catch {
    res.status(404).send('Not found')
  }
})
