import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { listAgents } from '../api/agents'
import { listModels } from '../api/misc'

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
  const [loadingAgents, setLoadingAgents] = createSignal(false)
  const [loadingModels, setLoadingModels] = createSignal(false)
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
    setLoadingAgents(true)
    try {
      const data = await listAgents(props.folder)
      setAgents(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAgents(false)
    }
  }

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const data = await listModels()
      setModels(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSave = () => {
    void props.onSave(selectedAgent(), selectedModel())
    props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-[#30363d] dark:bg-[#161b22]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#30363d] dark:bg-[#0d1117]">
            <h2 class="font-semibold text-gray-900 dark:text-gray-100">Session Settings</h2>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div class="space-y-4 p-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Agent</label>
              <Show
                when={!loadingAgents()}
                fallback={<div class="py-2 text-sm text-gray-500 dark:text-gray-400">Loading agents...</div>}
              >
                <select
                  value={selectedAgent()}
                  onChange={(e) => setSelectedAgent(e.currentTarget.value)}
                  class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                >
                  <option value="">Default</option>
                  <For each={agents()}>{(agent) => <option value={agent.name}>{agent.name}</option>}</For>
                </select>
              </Show>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
              <Show
                when={!loadingModels()}
                fallback={<div class="py-2 text-sm text-gray-500 dark:text-gray-400">Loading models...</div>}
              >
                <select
                  value={selectedModel()}
                  onChange={(e) => setSelectedModel(e.currentTarget.value)}
                  class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                >
                  <option value="">Default</option>
                  <For each={models()}>{(model) => <option value={model}>{model}</option>}</For>
                </select>
              </Show>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                onClick={props.onClose}
                class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#21262d]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
