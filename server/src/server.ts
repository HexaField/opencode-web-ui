import {
  AgentPartInput,
  FilePartInput,
  SubtaskPartInput,
  TextPartInput,
  type Message,
  type OpencodeClient,
  type Part,
  type Session,
  type SessionPromptData
} from '@opencode-ai/sdk'
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
import { z } from 'zod'
import { getCurrentBranch, getGitStatus, listGitBranches, runCopilotPrompt, runGitCommand } from './git.js'
import { OpencodeManager } from './opencode.js'
import { radicleService } from './radicle.js'
import {
  ConnectSchema,
  CreateAgentSchema,
  CreateSessionSchema,
  CreateTagSchema,
  CreateTaskSchema,
  DeleteAgentSchema,
  DeleteTaskTagSchema,
  FileReadSchema,
  FolderQuerySchema,
  FSDeleteSchema,
  FSListSchema,
  FSReadSchema,
  FSWriteSchema,
  GetSessionSchema,
  GitBranchSchema,
  GitCheckoutSchema,
  GitCommitSchema,
  GitPushPullSchema,
  GitStageSchema,
  SessionPromptSchema,
  TaskTagSchema,
  UpdateSessionSchema,
  UpdateTaskSchema
} from './schemas.js'

const exec = promisify(_exec)

const validate =
  (schema: z.ZodType<unknown>) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      schema.parse({
        body: req.body as unknown,
        query: req.query as unknown,
        params: req.params as unknown
      })
      next()
    } catch (error) {
      console.error('Validation error:', error)
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues })
      } else {
        res.status(500).json({ error: 'Internal Server Error' })
      }
    }
  }

const app = express()
app.use(cors())
app.use(bodyParser.json())

const manager = new OpencodeManager()

interface SessionWithHistory extends Session {
  history?: { info: Message; parts: Part[] }[]
}

// Helper to unwrap SDK response
function unwrap<T>(res: { data: T } | T): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return res.data
  }
  return res
}

interface AuthenticatedRequest extends express.Request {
  opencodeClient?: OpencodeClient
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
    ;(req as AuthenticatedRequest).opencodeClient = client
    ;(req as AuthenticatedRequest).targetFolder = folder
    next()
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: `Failed to connect: ${msg}` })
  }
}

app.post('/api/connect', validate(ConnectSchema), async (req, res) => {
  const { folder } = req.body as { folder?: string }
  if (!folder) {
    res.status(400).json({ error: 'Missing folder in body' })
    return
  }
  try {
    await manager.connect(folder)
    res.json({ success: true, folder })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/sessions', validate(FolderQuerySchema), withClient, async (req, res) => {
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
    const allMetadata = await manager.getAllSessionMetadata(folder)

    const filtered = Array.isArray(sessions)
      ? sessions
          .filter(
            (s) =>
              s.directory === folder ||
              s.directory === folder + '/' ||
              s.directory === realFolder ||
              s.directory === realFolder + '/'
          )
          .map((s) => ({ ...s, ...(allMetadata[s.id] || {}) }))
      : sessions

    res.json(filtered)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/sessions', validate(CreateSessionSchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const folder = (req as AuthenticatedRequest).targetFolder!

    const { agent, model, ...sessionData } = req.body as { agent?: string; model?: string; [key: string]: unknown }

    const session = await client.session.create({ body: sessionData })
    const data = unwrap(session)

    if (data && (agent || model)) {
      await manager.saveSessionMetadata(folder, data.id, { agent, model })
      Object.assign(data, { agent, model })
    }

    res.json(data)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/sessions/:id', validate(GetSessionSchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { id } = req.params

    const session = await client.session.get({ path: { id } })
    const raw = unwrap(session)
    const metadata = await manager.getSessionMetadata(folder, id)

    const messages = await client.session.messages({ path: { id } })
    const msgData = unwrap(messages)

    if (raw && typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>
      obj.history = msgData
      Object.assign(obj, metadata)
      res.json(obj)
    } else {
      res.status(404).json({ error: 'Session not found' })
    }
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.patch('/api/sessions/:id', validate(UpdateSessionSchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { id } = req.params
    const { agent, model, title } = req.body as { agent?: string; model?: string; title?: string }

    // Save metadata
    if (agent || model) {
      await manager.saveSessionMetadata(folder, id, { agent, model })
    }

    const result = await client.session.update({
      path: { id },
      body: { title }
    })
    const data = unwrap(result)

    // Merge metadata
    const metadata = await manager.getSessionMetadata(folder, id)
    const merged = { ...(data as object), ...metadata }

    res.json(merged)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/sessions/:id/events', validate(GetSessionSchema), withClient, async (req, res) => {
  const client = (req as AuthenticatedRequest).opencodeClient!
  const { id } = req.params

  const folder = (req as AuthenticatedRequest).targetFolder!

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let isActive = true
  req.on('close', () => {
    isActive = false
  })

  const fetchSession = async (): Promise<SessionWithHistory | undefined> => {
    const session = await client.session.get({ path: { id } })
    const raw = unwrap(session) as SessionWithHistory

    const messages = await client.session.messages({ path: { id } })
    const msgData = unwrap(messages)
    if (raw && typeof raw === 'object' && raw !== null) {
      raw.history = msgData
    }

    if (raw) {
      const metadata = await manager.getSessionMetadata(folder, id)
      Object.assign(raw, metadata)
    }

    return raw
  }

  // Initial fetch
  try {
    const session = await fetchSession()
    if (session) {
      res.write(`data: ${JSON.stringify(session)}\n\n`)
    }
  } catch (error) {
    console.error(error)
    console.error('Initial fetch error:', error)
  }

  // Use SDK event stream
  try {
    const { stream } = await client.event.subscribe({ query: { directory: folder } })

    for await (const event of stream) {
      if (!isActive) break

      let isRelevant = false

      if (event.type === 'session.updated' && event.properties?.info?.id === id) isRelevant = true
      if (event.type === 'message.updated' && event.properties?.info?.sessionID === id) isRelevant = true
      if (event.type === 'message.part.updated' && event.properties?.part?.sessionID === id) isRelevant = true
      if (event.type === 'message.part.removed' && event.properties?.sessionID === id) isRelevant = true
      if (event.type === 'message.removed' && event.properties?.sessionID === id) isRelevant = true

      if (isRelevant) {
        try {
          const session = await fetchSession()
          if (session) {
            res.write(`data: ${JSON.stringify(session)}\n\n`)
          }
        } catch (err) {
          console.error('Error fetching session update:', err)
        }
      }
    }
  } catch (error) {
    console.error(error)
    console.error('SDK Event Stream Error:', error)
  }
})

app.post('/api/sessions/:id/prompt', validate(SessionPromptSchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { id } = req.params

    const metadata = await manager.getSessionMetadata(folder, id)
    const requestBody = req.body as {
      parts: (TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput)[]
      model?: string
      agent?: string
    }

    const model = (requestBody.model || metadata.model) as string | undefined
    if (!model) {
      res.status(400).json({ error: 'Model is required' })
      return
    }

    const [providerID, modelID] = model.split('/')

    const agent = (requestBody.agent || metadata.agent) as string | undefined

    const body: SessionPromptData['body'] = {
      parts: requestBody.parts,
      model: {
        providerID,
        modelID
      },
      agent
    }

    const result = await client.session.prompt({
      path: { id },
      body: body as SessionPromptData['body']
    })
    if (result.error) {
      console.error('Prompt error:', result.error)
      res.status(500).json({ error: result.error })
      return
    }

    const data = unwrap(result)
    res.json(data)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/agents', validate(FolderQuerySchema), withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const agents = await manager.listAgents(folder)
    res.json(agents)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/agents', validate(CreateAgentSchema), withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { name, content } = req.body as { name: string; content: string }
    await manager.saveAgent(folder, name, content)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.delete('/api/agents/:name', validate(DeleteAgentSchema), withClient, async (req, res) => {
  try {
    const folder = (req as AuthenticatedRequest).targetFolder!
    const { name } = req.params
    await manager.deleteAgent(folder, name)
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/models', async (_req, res) => {
  try {
    const models = await manager.listModels()
    res.json(models)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/git/status', validate(FolderQuerySchema), async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const status = await getGitStatus(folder)
    res.json(status)
  } catch (err) {
    console.error('Failed to get git status:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/git/current-branch', validate(FolderQuerySchema), async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const branch = await getCurrentBranch(folder)
    res.json({ branch })
  } catch (err) {
    console.error('Failed to get current branch:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/git/branches', validate(FolderQuerySchema), async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Folder required' })
    return
  }
  try {
    const branches = await listGitBranches(folder)
    res.json(branches)
  } catch (err) {
    console.error('Failed to list branches:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/stage', validate(GitStageSchema), async (req, res) => {
  const { folder, files } = req.body as { folder?: string; files?: string[] }
  if (!folder || !files) {
    res.status(400).json({ error: 'Folder and files required' })
    return
  }
  try {
    await runGitCommand(['add', ...files], folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to stage files:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/unstage', validate(GitStageSchema), async (req, res) => {
  const { folder, files } = req.body as { folder?: string; files?: string[] }
  if (!folder || !files) {
    res.status(400).json({ error: 'Folder and files required' })
    return
  }
  try {
    await runGitCommand(['reset', 'HEAD', ...files], folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to unstage files:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/commit', validate(GitCommitSchema), async (req, res) => {
  const { folder, message } = req.body as { folder?: string; message?: string }
  if (!folder || !message) {
    res.status(400).json({ error: 'Folder and message required' })
    return
  }
  try {
    await runGitCommand(['commit', '-m', message], folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to commit:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/generate-commit-message', validate(ConnectSchema), async (req, res) => {
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
    console.error('Failed to generate commit message:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/push', validate(GitPushPullSchema), async (req, res) => {
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
    console.error('Failed to push:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/pull', validate(GitPushPullSchema), async (req, res) => {
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
    console.error('Failed to pull:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/checkout', validate(GitCheckoutSchema), async (req, res) => {
  const { folder, branch } = req.body as { folder?: string; branch?: string }
  if (!folder || !branch) {
    res.status(400).json({ error: 'Folder and branch required' })
    return
  }
  try {
    await runGitCommand(['checkout', branch], folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to checkout branch:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/branch', validate(GitBranchSchema), async (req, res) => {
  const { folder, branch, from } = req.body as { folder?: string; branch?: string; from?: string }
  if (!folder || !branch) {
    res.status(400).json({ error: 'Folder and branch required' })
    return
  }
  try {
    const args = ['branch', branch]
    if (from) args.push(from)
    await runGitCommand(args, folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to create branch:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/api/git/merge', validate(GitCheckoutSchema), async (req, res) => {
  const { folder, branch } = req.body as { folder?: string; branch?: string }
  if (!folder || !branch) {
    res.status(400).json({ error: 'Folder and branch required' })
    return
  }
  try {
    await runGitCommand(['merge', branch], folder)
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to merge branch:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/files/status', validate(FolderQuerySchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const status = await client.file.status()
    const data = unwrap(status)
    res.json(data)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/files/read', validate(FileReadSchema), withClient, async (req, res) => {
  try {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const path = req.query.path as string
    if (!path) {
      res.status(400).json({ error: 'Missing path query parameter' })
      return
    }
    const content = await client.file.read({ query: { path } })
    const data = unwrap(content)
    // Ensure we return an object with content property if the SDK returns raw string or similar
    if (typeof data === 'string') {
      res.json({ content: data })
    } else {
      res.json(data)
    }
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/fs/list', validate(FSListSchema), async (req, res) => {
  const dirPath = (req.query.path as string) || os.homedir()
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
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.get('/api/fs/read', validate(FSReadSchema), async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) {
    res.status(400).json({ error: 'Missing path query parameter' })
    return
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ content })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/fs/write', validate(FSWriteSchema), async (req, res) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string }
  if (!filePath || content === undefined) {
    res.status(400).json({ error: 'Missing path or content' })
    return
  }
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

app.post('/api/fs/delete', validate(FSDeleteSchema), async (req, res) => {
  const { path: filePath } = req.body as { path?: string }
  if (!filePath) {
    res.status(400).json({ error: 'Missing path' })
    return
  }
  try {
    await fs.rm(filePath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Return unified git diff for a single file (unified=3)
app.get('/api/files/diff', validate(FileReadSchema), async (req, res) => {
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
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Return summary of diffs (files changed, total added/removed lines)
app.get('/api/files/diff-summary', validate(FolderQuerySchema), async (req, res) => {
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
    console.error(error)
    const msg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: msg })
  }
})

// Serve static files
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '../../dist')

// Tasks API
app.get('/api/tasks', validate(FolderQuerySchema), async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const tasks = await radicleService.getTasks(folder)
    res.json(tasks)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tasks', validate(CreateTaskSchema), async (req, res) => {
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
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.put('/api/tasks/:id', validate(UpdateTaskSchema), async (req, res) => {
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
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.delete('/api/tasks/:id', validate(GetSessionSchema), async (req, res) => {
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
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.get('/api/tags', validate(FolderQuerySchema), async (req, res) => {
  const folder = req.query.folder as string
  if (!folder) {
    res.status(400).json({ error: 'Missing folder' })
    return
  }
  try {
    const tags = await radicleService.getTags(folder)
    res.json(tags)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tags', validate(CreateTagSchema), (req, res) => {
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
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.post('/api/tasks/:id/tags', validate(TaskTagSchema), async (req, res) => {
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
    console.error(error)
    res.status(500).json({ error: String(error) })
  }
})

app.delete('/api/tasks/:id/tags/:tagId', validate(DeleteTaskTagSchema), async (req, res) => {
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
    console.error(error)
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
