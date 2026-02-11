import { createSignal, onMount, Show } from 'solid-js'
import ChatInterface from './ChatInterface'
import { createSession, getSession } from '../api/sessions'
import SettingsModal from './SettingsModal'

export default function ChatPage() {
  const [sessionId, setSessionId] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

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
      setError('Failed to initialize chat.')
      console.error(e)
    }
  })

  return (
    <div class="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-[#0d1117]">
      <SettingsModal
        isOpen={isSettingsOpen()}
        onClose={() => setIsSettingsOpen(false)}
        onChangeFolder={() => (window.location.href = '/')}
      />

      <header class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-[#161b22]">
        <h1 class="text-lg font-bold text-gray-700 dark:text-gray-200">Global Assistant</h1>
        <div class="flex items-center gap-4">
          <button
            onClick={() => {
              localStorage.removeItem('pai_global_session')
              setSessionId(null)
              location.reload()
            }}
            class="text-sm text-blue-500 hover:underline"
          >
            New Session
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            class="flex items-center gap-2 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-[#21262d]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </button>
        </div>
      </header>

      <div class="relative min-h-0 flex-1 overflow-hidden">
        <Show when={!error()} fallback={<div class="p-8 text-center text-red-500">{error()}</div>}>
          <Show
            when={sessionId()}
            fallback={<div class="flex h-full items-center justify-center text-gray-400">Loading Assistant...</div>}
          >
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
