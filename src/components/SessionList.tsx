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
    <div class="w-full border-r border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] flex flex-col h-full transition-colors duration-200">
      <Show when={isAgentManagerOpen()}>
        <AgentManager
          folder={props.folder}
          onClose={() => {
            setIsAgentManagerOpen(false)
            fetchAgents() // Refresh agents list after closing manager
          }}
        />
      </Show>

      <div class="p-3 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center gap-2">
        <h3 class="font-semibold text-sm text-gray-900 dark:text-gray-100 shrink-0 hidden sm:block">Sessions</h3>
        <div class="flex items-center gap-1 min-w-0 flex-1 sm:flex-none justify-end">
          <button
            onClick={() => setIsAgentManagerOpen(true)}
            class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-[#21262d]"
            title="Manage Agents"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </button>

          <div class="relative flex-1 min-w-[100px] max-w-[150px]">
            <select
              value={selectedAgent()}
              onChange={(e) => setSelectedAgent(e.currentTarget.value)}
              class="w-full text-xs py-1.5 pl-2 pr-6 border border-gray-200 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none appearance-none truncate"
            >
              <option value="">Default</option>
              <For each={agents()}>{(agent) => <option value={agent.name}>{agent.name}</option>}</For>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-1 pointer-events-none text-gray-500">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>

          <button
            onClick={() => void handleCreateSession()}
            class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-[#21262d] shrink-0"
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
