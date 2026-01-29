import {
  AgentPartInput,
  FilePartInput,
  SubtaskPartInput,
  TextPartInput,
  type Event,
  type Message,
  type Part,
  type Session,
  type SessionPromptData
} from '@opencode-ai/sdk'
import express from 'express'
import * as fs from 'fs/promises'
import { AuthenticatedRequest, validate, withClient } from '../../middleware'
import { OpencodeManager, type OpencodeClient } from '../../opencode'
import { unwrap } from '../../utils'
import { FolderQuerySchema } from '../common/common.schema'
import {
  BranchSessionSchema,
  CreateSessionSchema,
  GetSessionSchema,
  RevertSessionSchema,
  SessionPromptSchema,
  UnrevertSessionSchema,
  UpdateSessionSchema
} from './sessions.schema'

interface SessionWithHistory extends Session {
  history?: { info: Message; parts: Part[] }[]
}

// Helper: Recursively fetch session history traversing parentID
const getSessionHistory = async (client: OpencodeClient, sessionID: string, depth = 0): Promise<any[]> => {
  if (depth > 20) return [] // Prevent infinite recursion

  // 1. Fetch this session's messages
  const msgResult = await client.session.messages({ path: { id: sessionID }, query: { limit: 10000 } })
  if (msgResult.error) return []
  let messages = unwrap(msgResult) as any[]

  // 2. Fetch session info for parentID and revert info
  const sessionResult = await client.session.get({ path: { id: sessionID } })
  if (sessionResult.error) return messages
  const session = unwrap(sessionResult) as Session

  // 3. Recurse if parent exists
  let revertInParent = false
  if (session.parentID) {
    let parentMessages = await getSessionHistory(client, session.parentID, depth + 1)

    // Check if this session is branched/reverted from a specific point in the ancestry
    const revertData = (session as any).revert as { messageID: string } | undefined
    if (revertData && revertData.messageID) {
      const idx = parentMessages.findIndex((m) => m.info.id === revertData.messageID)
      if (idx !== -1) {
        // Slice the ancestry to the fork point, discarding "future" messages from the parent timeline
        parentMessages = parentMessages.slice(0, idx + 1)
        revertInParent = true
      }
    }

    messages = [...parentMessages, ...messages]
  }

  // 4. Sort
  messages.sort((a, b) => {
    const tA = a.info?.time?.created || 0
    const tB = b.info?.time?.created || 0
    return tA - tB
  })

  // 5. Apply Revert / Slice logic (Only for local revert within own messages)
  // If the revert point was in parentMessages, we handled it above.
  const revertData = (session as any).revert as { messageID: string } | undefined
  if (revertData && revertData.messageID && !revertInParent) {
    const idx = messages.findIndex((m) => m.info.id === revertData.messageID)
    if (idx !== -1) {
      messages = messages.slice(0, idx + 1)
    }
  }

  return messages
}

export function registerSessionsRoutes(app: express.Application, manager: OpencodeManager) {
  app.get('/api/sessions', validate(FolderQuerySchema), withClient(manager), async (req, res) => {
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
            .map((s) => ({ ...s, ...allMetadata[s.id] }))
        : sessions

      res.json(filtered)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/sessions', validate(CreateSessionSchema), withClient(manager), async (req, res) => {
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

  app.get('/api/sessions/:id', validate(GetSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { id } = req.params as { id: string }

      const session = await client.session.get({ path: { id } })
      const raw = unwrap(session)
      const metadata = await manager.getSessionMetadata(folder, id)

      if (raw && typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>

        // Use helper to fetch full history (including parents)
        const validMessages = await getSessionHistory(client, id)

        obj.history = validMessages
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

  // Get session status
  app.get('/api/sessions/:id/status', validate(GetSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const { id } = req.params as { id: string }

      // @ts-expect-error - Status method type definition might be missing in current SDK version
      const result = await client.session.status({ path: { id } })

      const possibleError = (result as { error?: unknown }).error
      if (possibleError) {
        console.error('Status error:', possibleError)
        res.status(500).json({ error: possibleError })
        return
      }

      // If status result is wrapped or just returns the status string directly
      // Adjust based on actual SDK response structure
      const data = unwrap(result)

      // If data is just a string (e.g. 'idle'), wrap it
      if (typeof data === 'string') {
        res.json({ status: data })
      } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        res.json(data)
      } else {
        // Default to idle if empty (SDK seems to return empty object when idle)
        res.json({ status: 'idle' })
      }
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.patch('/api/sessions/:id', validate(UpdateSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { id } = req.params as { id: string }
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

  app.get('/api/sessions/:id/events', validate(GetSessionSchema), withClient(manager), async (req, res) => {
    const client = (req as AuthenticatedRequest).opencodeClient!
    const { id } = req.params as { id: string }

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

      if (raw && typeof raw === 'object' && raw !== null) {
        const validMessages = await getSessionHistory(client, id)
        raw.history = validMessages
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
      const sub = await client.event.subscribe({ query: { directory: folder } })
      const stream = sub.stream
      const iterator = stream[Symbol.asyncIterator]()

      const closePromise = new Promise<void>((resolve) => {
        if (!isActive) resolve()
        req.on('close', resolve)
      })

      while (isActive) {
        const nextPacket = iterator.next()
        const result = await Promise.race([
          nextPacket,
          closePromise.then(() => ({ done: true, value: undefined }) as IteratorResult<Event, undefined>)
        ])

        if (result.done) break

        const event = result.value

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

      if (iterator.return) {
        await iterator.return(undefined)
      }
    } catch (error) {
      console.error(error)
      console.error('SDK Event Stream Error:', error)
    }
  })

  app.post('/api/sessions/:id/prompt', validate(SessionPromptSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { id } = req.params as { id: string }

      const metadata = await manager.getSessionMetadata(folder, id)
      const requestBody = req.body as {
        parts: (TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput)[]
        model?: string
        agent?: string
        messageID?: string
      }

      const model = (requestBody.model || metadata.model) as string | undefined
      if (!model) {
        res.status(400).json({ error: 'Model is required' })
        return
      }

      const [providerID, modelID] = model.split('/')

      const agent = (requestBody.agent || metadata.agent || undefined) as string | undefined

      const body: SessionPromptData['body'] = {
        parts: requestBody.parts,
        model: {
          providerID,
          modelID
        },
        agent,
        messageID: requestBody.messageID
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

  // Atomic Branch Endpoint
  app.post('/api/sessions/:id/branch', validate(BranchSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { id } = req.params as { id: string }
      const requestBody = req.body as {
        parts: (TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput)[]
        model?: string
        agent?: string
        messageID: string // The parent/fork point
      }

      // 1. Fork the session from the given message ID
      const forkResult = await client.session.fork({
        path: { id },
        body: { messageID: requestBody.messageID }
      })
      const newSession = unwrap(forkResult) as Session

      // Save metadata for new session
      const oldMetadata = await manager.getSessionMetadata(folder, id)
      // If new agent/model provided use those, otherwise copy from old session
      const agent = (requestBody.agent || oldMetadata.agent) as string | undefined
      const model = (requestBody.model || oldMetadata.model) as string | undefined

      if (agent || model) {
        await manager.saveSessionMetadata(folder, newSession.id, { agent, model })
      }

      // 2. Prompt the new session
      if (!model) {
        res.status(400).json({ error: 'Model is required (or inherited from parent)' })
        return
      }

      const [providerID, modelID] = model.split('/')

      const promptBody: SessionPromptData['body'] = {
        parts: requestBody.parts,
        model: { providerID, modelID },
        agent: agent || undefined
        // We do NOT pass messageID here because we are at the HEAD of the new forked session
      }

      // Don't await prompt result here to have client redirect to new session immediately
      client.session.prompt({
        path: { id: newSession.id },
        body: promptBody
      }).then((promptResult) => {
        if ((promptResult as { error?: unknown }).error) {
          const err = (promptResult as { error?: unknown }).error
          console.error('Prompt error on branch:', err)
          res.status(500).json({ error: err })
          return
        }
      })

      // Return the new session details (could also return the message)
      // The frontend expects the new session ID to redirect
      res.json({ id: newSession.id })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  // Abort a running session
  app.post('/api/sessions/:id/abort', validate(GetSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const folder = (req as AuthenticatedRequest).targetFolder!
      const { id } = req.params as { id: string }

      const result = await client.session.abort({ path: { id } })
      const possibleError = (result as { error?: unknown }).error
      if (possibleError) {
        console.error('Abort error:', possibleError)
        res.status(500).json({ error: possibleError })
        return
      }

      const data = unwrap(result)
      // Optionally merge metadata
      const metadata = await manager.getSessionMetadata(folder, id)
      if (data && typeof data === 'object') Object.assign(data, metadata)

      res.json(data)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/sessions/:id/revert', validate(RevertSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const { id } = req.params as { id: string }
      const { messageID, partID } = req.body as { messageID?: string; partID?: string }

      // @ts-ignore - The SDK definition might be strict about body content, but at runtime this is correct
      const result = await client.session.revert({
        path: { id },
        body: messageID ? { messageID, partID } : undefined
      })
      res.json(unwrap(result))
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/sessions/:id/unrevert', validate(UnrevertSessionSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const { id } = req.params as { id: string }

      const result = await client.session.unrevert({
        path: { id }
      })
      res.json(unwrap(result))
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })
}
