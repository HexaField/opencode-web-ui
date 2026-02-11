import { createSignal, onMount, Show } from 'solid-js'
import ChatInterface from './ChatInterface'
import { createSession, getSession } from '../api/sessions'

export default function ChatPage() {
  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    try {
      const saved = localStorage.getItem('pai_global_session')
      let validSessionId: string | null = null

      if (saved) {
        try {
          await getSession('.', saved)
          validSessionId = saved
        } catch {
          console.warn('Saved global session invalid or expired, creating new one.')
        }
      }

      if (validSessionId) {
        setSessionId(validSessionId)
      } else {
        // Create a 'general' session in the current working directory (System Context)
        const s = await createSession('.', {
          agent: 'Default',
          model: 'github-copilot/gemini-3-pro'
        })
        setSessionId(s.id)
        localStorage.setItem('pai_global_session', s.id)
      }
    } catch (e) {
      setError('Failed to initialize chat.')
      console.error(e)
    }
  })

  return (
    <div class="h-full w-full bg-white dark:bg-[#0d1117]">
      <Show when={!error()} fallback={<div class="p-8 text-center text-red-500">{error()}</div>}>
        <Show
          when={sessionId()}
          fallback={<div class="flex h-full items-center justify-center text-gray-400">Loading Assistant...</div>}
        >
          <ChatInterface
            folder="."
            sessionId={sessionId()!}
            onSessionChange={(id) => {
              setSessionId(id)
              localStorage.setItem('pai_global_session', id)
            }}
          />
        </Show>
      </Show>
    </div>
  )
}
