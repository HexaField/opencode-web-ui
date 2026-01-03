import {
  AgentPartInput,
  FilePartInput,
  SubtaskPartInput,
  TextPartInput,
  type Message,
  type Part,
  type Session,
  type SessionPromptData
} from '@opencode-ai/sdk'
import express from 'express'
import * as fs from 'fs/promises'
import { AuthenticatedRequest, validate, withClient } from '../../middleware'
import { OpencodeManager } from '../../opencode'
import { unwrap } from '../../utils'
import { FolderQuerySchema } from '../common/common.schema'
import { CreateSessionSchema, GetSessionSchema, SessionPromptSchema, UpdateSessionSchema } from './sessions.schema'

interface SessionWithHistory extends Session {
  history?: { info: Message; parts: Part[] }[]
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
            .map((s) => ({ ...s, ...(allMetadata[s.id] || {}) }))
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

  app.patch('/api/sessions/:id', validate(UpdateSessionSchema), withClient(manager), async (req, res) => {
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

  app.get('/api/sessions/:id/events', validate(GetSessionSchema), withClient(manager), async (req, res) => {
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

  app.post('/api/sessions/:id/prompt', validate(SessionPromptSchema), withClient(manager), async (req, res) => {
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
}
