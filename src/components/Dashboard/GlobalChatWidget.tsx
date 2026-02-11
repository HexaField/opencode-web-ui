import { createSignal, onMount, Show } from 'solid-js'
import ChatInterface from '../ChatInterface'
import { createSession, getSession } from '../../api/sessions'

export default function GlobalChatWidget() {
  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    try {
      const saved = localStorage.getItem('pai_global_session')
      let validSessionId: string | null = null

      if (saved) {
        try {
          await getSession('AGENT', saved)
          validSessionId = saved
        } catch {
          console.warn('Saved global session invalid or expired, creating new one.')
        }
      }

      if (validSessionId) {
        setSessionId(validSessionId)
      } else {
        // Create a 'general' session in the System Context
        const s = await createSession('AGENT', {
          agent: 'Default',
          model: 'github-copilot/gemini-3-pro-preview'
        })
        setSessionId(s.id)
        localStorage.setItem('pai_global_session', s.id)
      }
    } catch (e) {
      setError('Failed to initialize global chat.')
      console.error(e)
    }
  })

  return (
    <div class="flex h-[500px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#0d1117]">
      <header class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-[#161b22]">
        <h3 class="font-bold text-gray-700 dark:text-gray-200">Global Assistant</h3>
        <button
          onClick={() => {
            localStorage.removeItem('pai_global_session')
            setSessionId(null)
            // Trigger re-mount or re-fetch logic
            location.reload() // Simple reset for now
          }}
          class="text-xs text-blue-500 hover:underline"
        >
          New Session
        </button>
      </header>
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <Show when={!error()} fallback={<div class="p-4 text-red-500">{error()}</div>}>
          <Show when={sessionId()} fallback={<div class="p-4 text-gray-400">Loading Assistant...</div>}>
            <ChatInterface
              folder="AGENT"
              sessionId={sessionId()!}
              onSessionChange={(id) => {
                setSessionId(id)
                localStorage.setItem('pai_global_session', id)
              }}
            />
          </Show>
        </Show>
      </div>
    </div>
  )
}
