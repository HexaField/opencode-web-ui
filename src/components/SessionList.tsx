import { createEffect, createSignal, For, Show } from 'solid-js'
import { listAgents, type Agent } from '../api/agents'
import { createSession, listSessions } from '../api/sessions'
import AgentManager from './AgentManager'

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
  const [agents, setAgents] = createSignal<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = createSignal<string>('')
  const [error, setError] = createSignal<string | null>(null)
  const [isAgentManagerOpen, setIsAgentManagerOpen] = createSignal(false)

  const fetchSessions = () => {
    setError(null)
    listSessions(props.folder)
      .then((data) => {
        if (Array.isArray(data)) setSessions(data as Session[])
      })
      .catch((err) => setError(String(err)))
  }

  const fetchAgents = () => {
    listAgents(props.folder)
      .then((data) => setAgents(data))
      .catch((err) => console.error('Failed to fetch agents:', err))
  }

  createEffect(() => {
    if (props.folder) {
      fetchSessions()
      fetchAgents()
    }
  })

  const handleCreateSession = async () => {
    setError(null)
    try {
      const body: { title: string; agent?: string } = { title: 'New Session' }
      if (selectedAgent()) {
        body.agent = selectedAgent()
      }

      const session = await createSession(props.folder, body)
      if (session.id) {
        fetchSessions()
        props.onSelectSession(session.id)
      } else {
        console.error('Session created but no ID returned', session)
        setError('Session created but no ID returned')
      }
    } catch (err) {
      console.error('Error creating session:', err)
      setError(String(err))
    }
  }

  return (
    <div class="flex h-full w-full flex-col border-r border-gray-200 bg-[#f6f8fa] transition-colors duration-200 dark:border-[#30363d] dark:bg-[#010409]">
      <Show when={isAgentManagerOpen()}>
        <AgentManager
          folder={props.folder}
          onClose={() => {
            setIsAgentManagerOpen(false)
            fetchAgents() // Refresh agents list after closing manager
          }}
        />
      </Show>

      <div class="flex items-center justify-between gap-2 border-b border-gray-200 p-3 dark:border-[#30363d]">
        <h3 class="hidden shrink-0 text-sm font-semibold text-gray-900 sm:block dark:text-gray-100">Sessions</h3>
        <div class="flex min-w-0 flex-1 items-center justify-end gap-1 sm:flex-none">
          <button
            onClick={() => setIsAgentManagerOpen(true)}
            class="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-[#21262d] dark:hover:text-blue-400"
            title="Manage Agents"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </button>

          <div class="relative max-w-[150px] min-w-[100px] flex-1">
            <select
              value={selectedAgent()}
              onChange={(e) => setSelectedAgent(e.currentTarget.value)}
              class="w-full appearance-none truncate rounded border border-gray-200 bg-white py-1.5 pr-6 pl-2 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300"
            >
              <option value="">Default</option>
              <For each={agents()}>{(agent) => <option value={agent.name}>{agent.name}</option>}</For>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>

          <button
            onClick={() => void handleCreateSession()}
            class="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-[#21262d] dark:hover:text-blue-400"
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
      </div>
      {error() && (
        <div class="border-b border-red-100 bg-red-50 p-2 text-xs text-red-500 dark:border-red-900 dark:bg-red-900/20">
          {error()}
        </div>
      )}
      <div class="flex-1 space-y-1 overflow-y-auto p-2">
        <For each={sessions()}>
          {(session) => (
            <div
              class={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors ${
                props.currentSessionId === session.id
                  ? "border border-gray-200 bg-white font-medium text-gray-900 shadow-sm dark:border-[#363b42] dark:bg-[#21262d] dark:text-gray-100"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#161b22] dark:hover:text-gray-200"
              } `}
              onClick={() => props.onSelectSession(session.id)}
            >
              <div class="truncate">{session.title || session.id}</div>
              <div class="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                {session.id.substring(0, 8)}...
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
