import { createEffect, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'

interface Agent {
  name: string
  content: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  folder: string
  onStartSession: (sessionTitle: string, agentId: string, prompt: string) => Promise<void>
}

export default function StartSessionModal(props: Props) {
  const [agents, setAgents] = createSignal<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = createSignal<string>('')
  const [prompt, setPrompt] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    if (props.isOpen && props.folder) {
      fetch(`/api/agents?folder=${encodeURIComponent(props.folder)}`)
        .then((res) => res.json())
        .then((data: unknown) => {
          const agentsList = data as Agent[]
          setAgents(agentsList)
          if (agentsList.length > 0 && !selectedAgent()) {
            setSelectedAgent(agentsList[0].name)
          }
        })
        .catch((err) => setError(String(err)))
    }
  })

  createEffect(() => {
    if (props.isOpen && props.task) {
      setPrompt(`I am working on the task: "${props.task.title}".\n\nDescription: ${props.task.description || ''}\n\nPlease help me with this task.`)
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!props.task || !selectedAgent()) return

    setLoading(true)
    setError(null)
    try {
      await props.onStartSession(`Task: ${props.task.title}`, selectedAgent(), prompt())
      props.onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Show when={props.isOpen && props.task}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="bg-white dark:bg-[#0d1117] rounded-lg shadow-xl w-full max-w-md p-6 flex flex-col border border-gray-200 dark:border-[#30363d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Start Session for Task</h3>
            <button onClick={props.onClose} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent</label>
              <select
                value={selectedAgent()}
                onChange={(e) => setSelectedAgent(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-md bg-white dark:bg-[#161b22] border-gray-300 dark:border-[#30363d] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <For each={agents()}>
                  {(agent) => <option value={agent.name}>{agent.name}</option>}
                </For>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Prompt</label>
              <textarea
                value={prompt()}
                onInput={(e) => setPrompt(e.currentTarget.value)}
                rows={5}
                class="w-full px-3 py-2 border rounded-md bg-white dark:bg-[#161b22] border-gray-300 dark:border-[#30363d] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            <Show when={error()}>
              <div class="text-red-500 text-sm">{error()}</div>
            </Show>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading()}
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  )
}
