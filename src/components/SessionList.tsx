import { createEffect, createSignal, For } from 'solid-js'

interface Session {
  id: string
  title: string
}

interface Props {
  folder: string
  currentSessionId: string | null
  onSelectSession: (id: string) => void
}

export default function SessionList(props: Props) {
  const [sessions, setSessions] = createSignal<Session[]>([])
  const [error, setError] = createSignal<string | null>(null)

  const fetchSessions = () => {
    setError(null)
    fetch(`/sessions?folder=${encodeURIComponent(props.folder)}`)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setSessions(data as Session[])
      })
      .catch((err) => setError(String(err)))
  }

  createEffect(() => {
    if (props.folder) fetchSessions()
  })

  const createSession = async () => {
    setError(null)
    try {
      const res = await fetch(`/sessions?folder=${encodeURIComponent(props.folder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Session' })
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to create session: ${res.status} ${text}`)
      }
      const data = (await res.json()) as unknown
      const session = data as Session
      if (session.id) {
        fetchSessions()
        props.onSelectSession(session.id)
      } else {
        console.error('Session created but no ID returned', data)
        setError('Session created but no ID returned')
      }
    } catch (err) {
      console.error('Error creating session:', err)
      setError(String(err))
    }
  }

  return (
    <div class="w-full border-r border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] flex flex-col h-full transition-colors duration-200">
      <div class="p-3 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center">
        <h3 class="font-semibold text-sm text-gray-900 dark:text-gray-100">Sessions</h3>
        <button
          onClick={() => void createSession()}
          class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-[#21262d]"
          title="New Session"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>
      {error() && (
        <div class="p-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900">
          {error()}
        </div>
      )}
      <div class="overflow-y-auto flex-1 p-2 space-y-1">
        <For each={sessions()}>
          {(session) => (
            <div
              class={`
                px-3 py-2 rounded-md cursor-pointer text-sm transition-colors
                ${
                  props.currentSessionId === session.id
                    ? 'bg-white dark:bg-[#21262d] shadow-sm text-gray-900 dark:text-gray-100 font-medium border border-gray-200 dark:border-[#363b42]'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#161b22] hover:text-gray-900 dark:hover:text-gray-200'
                }
              `}
              onClick={() => props.onSelectSession(session.id)}
            >
              <div class="truncate">{session.title || session.id}</div>
              <div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {session.id.substring(0, 8)}...
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
