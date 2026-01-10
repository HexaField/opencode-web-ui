import { createEffect, createSignal, For, Show } from 'solid-js'
import { listAgents } from '../../api/agents'
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
  onStartSession: (sessionTitle: string, agentId: string, prompt: string, taskId?: string) => Promise<void>
}

export default function StartSessionModal(props: Props) {
  const [agents, setAgents] = createSignal<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = createSignal<string>('')
  const [prompt, setPrompt] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    if (props.isOpen && props.folder) {
      listAgents(props.folder)
        .then((agentsList) => {
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
      setPrompt(
        `I am working on the task: "${props.task.title}".\n\nDescription: ${props.task.description || ''}\n\nPlease help me with this task.`
      )
    }
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!props.task || !selectedAgent()) return

    setLoading(true)
    setError(null)
    try {
      await props.onStartSession(`Task: ${props.task.title}`, selectedAgent(), prompt(), props.task.id)
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
          class="flex w-full max-w-md flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-[#30363d] dark:bg-[#0d1117]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="mb-4 flex items-center justify-between">
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
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Agent</label>
              <select
                value={selectedAgent()}
                onChange={(e) => setSelectedAgent(e.currentTarget.value)}
                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#161b22]"
              >
                <For each={agents()}>{(agent) => <option value={agent.name}>{agent.name}</option>}</For>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Initial Prompt</label>
              <textarea
                value={prompt()}
                onInput={(e) => setPrompt(e.currentTarget.value)}
                rows={5}
                class="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#161b22]"
              />
            </div>

            <Show when={error()}>
              <div class="text-sm text-red-500">{error()}</div>
            </Show>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={props.onClose}
                class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#21262d]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading()}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
