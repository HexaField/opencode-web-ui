import { OpencodeManager } from '../../opencode.js'
import { bus, Events } from '../event-bus.js'
import { ReflectionService } from './reflection.service.js'
import { unwrap } from '../../utils.js'

async function simplePrompt(manager: OpencodeManager, promptText: string, systemText?: string): Promise<string> {
  const client = await manager.connect(process.cwd())

  // 1. Create Session
  const sessionRes = await client.session.create({
    body: {
      title: 'Reflection Listener'
    }
  })

  if (sessionRes.error) {
    console.error('[ReflectionListener] Failed to create session:', sessionRes.error)
    return ''
  }
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
  return ''
}

export class ReflectionListener {
  private service: ReflectionService

  constructor(private manager: OpencodeManager) {
    // Reuse simple LLM wrapper
    const llmFn = async (prompt: string, systemPrompt?: string) => {
      return simplePrompt(this.manager, prompt, systemPrompt)
    }
    this.service = new ReflectionService(llmFn)
  }

  public register() {
    bus.on(Events.SESSION_ARCHIVED, async (payload: { sessionId: string; history: any[] }) => {
      console.log(`[ReflectionListener] Session archived: ${payload.sessionId}. Starting analysis.`)
      try {
        // Must map History format to { role, text }
        // SDK Message history -> Reflection format
        const normalizedHistory = payload.history
          .map((msg) => {
            const textPart = msg.parts.find((p: any) => p.type === 'text')
            return {
              role: msg.info?.role || msg.info?.author?.role || 'user',
              text: textPart ? textPart.text : ''
            }
          })
          .filter((m) => m.text)

        await this.service.analyzeSession(payload.sessionId, normalizedHistory)
        console.log(`[ReflectionListener] Analysis complete for ${payload.sessionId}`)
      } catch (error) {
        console.error(`[ReflectionListener] Error analyzing session ${payload.sessionId}:`, error)
      }
    })
    console.log('[ReflectionListener] Registered')
  }
}
