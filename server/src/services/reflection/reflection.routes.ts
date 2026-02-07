import express from 'express'
import { OpencodeManager } from '../../opencode.js'
import { ReflectionService } from './reflection.service.js'
import { unwrap } from '../../utils.js'

async function simplePrompt(manager: OpencodeManager, promptText: string, systemText?: string): Promise<string> {
  const client = await manager.connect(process.cwd())

  // 1. Create Session
  const sessionRes = await client.session.create({
    body: {
      title: 'Reflection'
    }
  })

  if (sessionRes.error) throw new Error(String(sessionRes.error))
  const session = unwrap(sessionRes)
  const text = systemText ? `SYSTEM INSTRUCTIONS:\n${systemText}\n\nUSER QUERY:\n${promptText}` : promptText

  // 3. Send Prompt
  await client.session.prompt({
    path: { id: session.id },
    body: { parts: [{ type: 'text', text }] }
  })

  // 4. Poll for response (max 60s)
  const start = Date.now()
  while (Date.now() - start < 60000) {
    await new Promise((r) => setTimeout(r, 1000))
    const msgRes = await client.session.messages({ path: { id: session.id }, query: { limit: 10 } })
    if (msgRes.error) continue

    const messages = unwrap(msgRes) as any[]
    if (messages.length < 2) continue // Wait for response

    const last = messages[messages.length - 1]
    const role = last.info?.role || last.info?.author?.role

    if (role === 'assistant' || role === 'model') {
      const content = last.parts.find((p: any) => p.type === 'text')?.text
      return content || ''
    }
  }
  throw new Error('Timeout waiting for LLM')
}

export function registerReflectionRoutes(app: express.Express, manager: OpencodeManager) {
  const llmFn = async (prompt: string, systemPrompt?: string) => {
    return simplePrompt(manager, prompt, systemPrompt)
  }

  const service = new ReflectionService(llmFn)

  app.post('/api/sessions/:id/analyze', async (req, res) => {
    try {
      const sessionId = req.params.id
      const history = req.body.history

      if (!history || !Array.isArray(history)) {
        res.status(400).json({ error: 'Valid history array required' })
        return
      }

      console.log(`[Reflection] Analyzing session ${sessionId}...`)
      await service.analyzeSession(sessionId, history)
      console.log(`[Reflection] Analysis complete for ${sessionId}`)

      res.json({ success: true })
    } catch (error) {
      console.error('[Reflection] Error:', error)
      res.status(500).json({ error: 'Internal Server Error' })
    }
  })
}
