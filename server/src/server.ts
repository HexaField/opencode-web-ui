import { type Session } from '@opencode-ai/sdk'
import bodyParser from 'body-parser'
import { exec as _exec } from 'child_process'
import cors from 'cors'
import express from 'express'
import * as fs from 'fs/promises'
import * as http from 'http'
import * as os from 'os'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { getCurrentBranch, getGitStatus, listGitBranches, runCopilotPrompt, runGitCommand } from './git.js'
import { OpencodeManager } from './opencode.js'
import { radicleService } from './radicle.js'
const exec = promisify(_exec)

const app = express()
app.use(cors())
app.use(bodyParser.json())

const manager = new OpencodeManager()

// Helper to unwrap SDK response
function unwrap<T>(res: { data: T } | T): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return res.data
  }
  return res
}

// Typed interface for SDK client
interface TypedClient {
  session: {
    list(): Promise<{ data: Session[] }>
    create(args: { body: unknown }): Promise<{ data: Session }>
    prompt(args: { path: { id: string }; body: unknown }): Promise<{ data: unknown }>
    get?(args: { path: { id: string } }): Promise<{ data: Session }>
    messages?(args: { path: { id: string } }): Promise<{ data: unknown[] }>
  }
  file: {
    status(): Promise<{ data: unknown }>
    read(args: { query: { path: string } }): Promise<{ data: unknown }>
  }
}

interface AuthenticatedRequest extends express.Request {
  opencodeClient?: TypedClient
  targetFolder?: string
}

// Middleware to ensure connection
const withClient = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder query parameter' })
    return
  }
  try {
    const client = await manager.connect(folder)
    ;(req as AuthenticatedRequest).opencodeClient = client as unknown as TypedClient
    ;(req as AuthenticatedRequest).targetFolder = folder
    next()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Failed to connect: ${msg}` })
  }
}

app.post('/api/connect', async (req, res) => {
  const { folder } = req.body as { folder?: string }
  if (!folder) {
    res.status(400).json({ error: 'Missing folder in body' })
    return
  }
  try {
    await manager.connect(folder)
    res.json({ success: true, folder })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/sessions', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const folder = (req as AuthenticatedRequest).targetFolder!

    let realFolder = folder
    try {
      realFolder = await fs.realpath(folder)
    } catch {
      // ignore
    }

    const response = await client.session.list()
    const sessions = unwrap(response)
    const filtered = Array.isArray(sessions)
      ? sessions.filter(
          (s) =>
            s.directory === folder ||
            s.directory === folder + '/' ||
            s.directory === realFolder ||
            s.directory === realFolder + '/'
        )
      : sessions

    res.json(filtered)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/sessions', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const session = await client.session.create({ body: req.body })
    const data = unwrap(session)
    res.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/sessions/:id', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const { id } = req.params

    // Check if 'get' method exists safely
    const sessionClient = client.session

    if (typeof sessionClient.get === 'function') {
      const session = await sessionClient.get({ path: { id } })
      const raw = unwrap(session)

      if (typeof sessionClient.messages === 'function') {
        const messages = await sessionClient.messages({ path: { id } })
        const msgData = unwrap(messages)
        if (raw && typeof raw === 'object' && raw !== null) {
          const obj = raw as Record<string, unknown>
          obj.history = msgData
          res.json(obj)
          return
        }
      } else {
        console.log('sessionClient.messages is not a function')
      }

      res.json(raw)
    } else {
      const response = await client.session.list()
      const sessions = unwrap(response)
      const session = sessions.find((s) => s.id === id)
      if (session) res.json(session)
      else res.status(404).json({ error: 'Session not found' })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/sessions/:id/prompt', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const { id } = req.params
    const result = await client.session.prompt({
      path: { id },
      body: req.body
    })
    const data = unwrap(result)
    res.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/agents', withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const agents = await manager.listAgents(folder)
    res.json(agents)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/agents', withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { name, content } = req.body as { name: string; content: string }
    await manager.saveAgent(folder, name, content)
    res.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.delete('/api/agents/:name', withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { name } = req.params
    await manager.deleteAgent(folder, name)
    res.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/models', async (_req, res) => {
  try {
    const models = await manager.listModels()
    res.json(models)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/git/status', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const status = await getGitStatus(folder)
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/git/current-branch', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const branch = await getCurrentBranch(folder)
    res.json({ branch })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/git/branches', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const branches = await listGitBranches(folder)
    res.json(branches)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/stage', async (req, res) => {
  const { folder, files } = req.body as { folder?: string; files?: string[] }
  if (!folder || !files) {
    res.status(400).json({ error: 'Folder and files required' })
    return
  }
  try {
    await runGitCommand(['add', ...files], folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/unstage', async (req, res) => {
  const { folder, files } = req.body as { folder?: string; files?: string[] }
  if (!folder || !files) {
    res.status(400).json({ error: 'Folder and files required' })
    return
  }
  try {
    await runGitCommand(['reset', 'HEAD', ...files], folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/commit', async (req, res) => {
  const { folder, message } = req.body as { folder?: string; message?: string }
  if (!folder || !message) {
    res.status(400).json({ error: 'Folder and message required' })
    return
  }
  try {
    await runGitCommand(['commit', '-m', message], folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/generate-commit-message', async (req, res) => {
  const { folder } = req.body as { folder?: string }
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    let prompt = 'Generate a concise git commit message following conventional commit format (type: description). '
    let diffContext = ''
    try {
      diffContext = await runGitCommand(['diff', '--staged'], folder)
      if (!diffContext.trim()) {
        diffContext = await runGitCommand(['diff'], folder)
      }
    } catch {
      /* continue */
    }
    if (diffContext.trim()) {
      prompt += `Here are the changes:\n\n${diffContext}\n\n`
    } else {
      prompt += 'Analyze the repository changes and generate an appropriate commit message. '
    }
    prompt += 'Only return the commit message, nothing else.'

    const message = await runCopilotPrompt(prompt, folder)
    res.json({ message })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/push', async (req, res) => {
  const { folder, remote, branch } = req.body as { folder?: string; remote?: string; branch?: string }
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const args = ['push']
    if (remote) args.push(remote)
    if (branch) args.push(branch)
    await runGitCommand(args, folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/pull', async (req, res) => {
  const { folder, remote, branch } = req.body as { folder?: string; remote?: string; branch?: string }
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const args = ['pull']
    if (remote) args.push(remote)
    if (branch) args.push(branch)
    await runGitCommand(args, folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/checkout', async (req, res) => {
  const { folder, branch } = req.body as { folder?: string; branch?: string }
  if (!folder || !branch) {
    res.status(400).json({ error: 'Folder and branch required' })
    return
  }
  try {
    await runGitCommand(['checkout', branch], folder)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/files/status', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const status = await client.file.status()
    const data = unwrap(status)
    res.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/files/read', withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const path = req.query.path as string
    if (!path) {
      res.status(400).json({ error: 'Missing path query parameter' })
      return
    }
    const content = await client.file.read({ query: { path } })
    const data = unwrap(content)
    res.json(data)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/fs/list', async (req, res) => {
  const dirPath = (req.query.path as string) || os.homedir()
  console.log('Listing dir:', dirPath)
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const files = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name)
    }))
    // Sort directories first
    files.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
      return a.isDirectory ? -1 : 1
    })
    res.setHeader('x-current-path', dirPath)
    res.json(files)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/fs/read', async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) {
    res.status(400).json({ error: 'Missing path query parameter' })
    return
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ content })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/fs/write', async (req, res) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string }
  if (!filePath || content === undefined) {
    res.status(400).json({ error: 'Missing path or content' })
    return
  }
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    res.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/fs/delete', async (req, res) => {
  const { path: filePath } = req.body as { path?: string }
  if (!filePath) {
    res.status(400).json({ error: 'Missing path' })
    return
  }
  try {
    await fs.rm(filePath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Return unified git diff for a single file (unified=3)
app.get('/api/files/diff', async (req, res) => {
  const folder = req.query.folder as string
  const filePath = req.query.path as string
  if (!folder || !filePath) {
    res.status(400).json({ error: 'Missing folder or path' })
    return
  }
  try {
    // Run git diff for the path with 3 lines of context
    const cmd = `git -C ${JSON.stringify(folder)} diff --unified=3 -- ${JSON.stringify(filePath)}`
    const { stdout, stderr } = await exec(cmd)
    if (stderr) {
      // non-fatal, include in response
      res.json({ diff: stdout || '', stderr })
      return
    }
    res.json({ diff: stdout || '' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Return summary of diffs (files changed, total added/removed lines)
app.get('/api/files/diff-summary', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    // git diff --numstat gives: added\tremoved\tpath
    const cmd = `git -C ${JSON.stringify(folder)} diff --numstat`
    const { stdout } = await exec(cmd)
    if (!stdout) {
      res.json({ filesChanged: 0, added: 0, removed: 0, details: [] })
      return
    }
    const lines = stdout.split('\n').filter(Boolean)
    let added = 0
    let removed = 0
    const details: Array<{ path: string; added: number; removed: number }> = []
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length >= 3) {
        const a = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0
        const r = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0
        const p = parts.slice(2).join('\t')
        added += a
        removed += r
        details.push({ path: p, added: a, removed: r })
      }
    }
    res.json({ filesChanged: details.length, added, removed, details })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Serve static files
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '../../dist')

// Tasks API
app.get('/api/tasks', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const tasks = await radicleService.getTasks(folder)
    res.json(tasks)
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tasks', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { title, description, parent_id, status, dependencies } = req.body as {
      title: string
      description?: string
      parent_id?: string
      status?: 'todo' | 'in-progress' | 'done'
      dependencies?: string[]
    }
    const task = await radicleService.createTask(folder, { title, description, parent_id, status, dependencies })
    res.json(task)
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.put('/api/tasks/:id', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { id } = req.params
    const { title, description, status, parent_id, position, dependencies } = req.body as {
      title?: string
      description?: string
      status?: 'todo' | 'in-progress' | 'done'
      parent_id?: string
      position?: number
      dependencies?: string[]
    }

    await radicleService.updateTask(folder, id, { title, description, status, parent_id, position, dependencies })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.delete('/api/tasks/:id', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { id } = req.params
    await radicleService.deleteTask(folder, id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.get('/api/tags', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const tags = await radicleService.getTags(folder)
    res.json(tags)
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tags', (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { name, color } = req.body as { name: string; color: string }
    // Radicle tags are just strings, so we don't persist them separately.
    // We just return what was sent to satisfy the frontend.
    res.json({ id: name, name, color })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tasks/:id/tags', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { id } = req.params
    const { tag_id } = req.body as { tag_id: string }
    await radicleService.addTag(folder, id, tag_id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

app.delete('/api/tasks/:id/tags/:tagId', async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const { id, tagId } = req.params
    await radicleService.removeTag(folder, id, tagId)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: String(error) })
  }
})

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

// Cleanup on exit
process.on('SIGINT', () => {
  manager.shutdown()
  process.exit()
})

export { app, manager }
