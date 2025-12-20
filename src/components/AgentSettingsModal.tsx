import { createEffect, createSignal, For, on, Show } from 'solid-js'

interface Props {
  isOpen: boolean
  onClose: () => void
  folder: string
  sessionId: string
  currentAgent?: string
  currentModel?: string
  onSave: (agent: string, model: string) => void | Promise<void>
}

export default function AgentSettingsModal(props: Props) {
  const [agents, setAgents] = createSignal<{ name: string }[]>([])
  const [models, setModels] = createSignal<string[]>([])
  const [selectedAgent, setSelectedAgent] = createSignal(props.currentAgent || '')
  const [selectedModel, setSelectedModel] = createSignal(props.currentModel || '')

  createEffect(
    on(
      () => props.isOpen,
      (isOpen) => {
        if (isOpen) {
          void fetchAgents()
          void fetchModels()
          setSelectedAgent(props.currentAgent || '')
          setSelectedModel(props.currentModel || '')
        }
      }
    )
  )

  const fetchAgents = async () => {
    try {
      const res = await fetch(`/api/agents?folder=${encodeURIComponent(props.folder)}`)
      const data = (await res.json()) as { name: string }[]
      setAgents(data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models')
      const data = (await res.json()) as string[]
      setModels(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = () => {
    void props.onSave(selectedAgent(), selectedModel())
    props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-sm bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-gray-200 dark:border-[#30363d] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="px-4 py-3 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center bg-gray-50 dark:bg-[#0d1117]">
            <h2 class="font-semibold text-gray-900 dark:text-gray-100">Session Settings</h2>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent</label>
              <select
                value={selectedAgent()}
                onChange={(e) => setSelectedAgent(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Default</option>
                <For each={agents()}>{(agent) => <option value={agent.name}>{agent.name}</option>}</For>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
              <select
                value={selectedModel()}
                onChange={(e) => setSelectedModel(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Default</option>
                <For each={models()}>{(model) => <option value={model}>{model}</option>}</For>
              </select>
            </div>

            <div class="pt-2 flex justify-end gap-2">
              <button
                onClick={props.onClose}
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
