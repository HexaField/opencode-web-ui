import { createEffect, createSignal, For, Show } from 'solid-js'
import { createAgent, deleteAgent, listAgents, type Agent } from '../api/agents'
import { listModels } from '../api/misc'

interface AgentConfig {
  description: string
  mode: 'primary' | 'subagent'
  model: string
  permission: {
    write: string
    edit: string
    bash: string
    webfetch: string
  }
  systemPrompt: string
}

interface Props {
  folder: string
  onClose: () => void
}

const DEFAULT_CONFIG: AgentConfig = {
  description: '',
  mode: 'primary',
  model: '',
  permission: {
    write: 'allow',
    edit: 'allow',
    bash: 'allow',
    webfetch: 'allow'
  },
  systemPrompt: ''
}

export default function AgentManager(props: Props) {
  const [agents, setAgents] = createSignal<Agent[]>([])
  const [models, setModels] = createSignal<string[]>([])
  const [selectedAgent, setSelectedAgent] = createSignal<string | null>(null)
  const [config, setConfig] = createSignal<AgentConfig>({ ...DEFAULT_CONFIG })
  const [error, setError] = createSignal<string | null>(null)
  const [isEditing, setIsEditing] = createSignal(false)
  const [editName, setEditName] = createSignal('')

  const fetchAgents = () => {
    return listAgents(props.folder)
      .then((data) => setAgents(data))
      .catch((err) => setError(String(err)))
  }

  const fetchModels = () => {
    listModels()
      .then((data) => setModels(data))
      .catch((err) => console.error('Failed to fetch models:', err))
  }

  createEffect(() => {
    void fetchAgents()
    void fetchModels()
  })

  const parseAgent = (content: string): AgentConfig => {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
      return { ...DEFAULT_CONFIG, systemPrompt: content }
    }

    const frontmatter = match[1]
    const systemPrompt = match[2].trim()
    const conf = { ...DEFAULT_CONFIG, systemPrompt }

    frontmatter.split('\n').forEach((line) => {
      const [key, ...rest] = line.split(':')
      if (!key || !rest) return
      const value = rest.join(':').trim()

      if (key.trim() === 'description') conf.description = value
      if (key.trim() === 'mode') conf.mode = value as 'primary' | 'subagent'
      if (key.trim() === 'model') conf.model = value
    })

    // Parse permission block
    const permissionMatch = frontmatter.match(/permission:\n([\s\S]*?)(?=\n\w+:|$)/)
    if (permissionMatch) {
      const permissionBlock = permissionMatch[1]
      permissionBlock.split('\n').forEach((line) => {
        const [tKey, tVal] = line.split(':').map((s) => s.trim())
        if (tKey && tVal) {
          // @ts-expect-error - dynamic assignment
          conf.permission[tKey] = tVal
        }
      })
    } else {
      // Fallback for old tools block
      const toolsMatch = frontmatter.match(/tools:\n([\s\S]*?)(?=\n\w+:|$)/)
      if (toolsMatch) {
        const toolsBlock = toolsMatch[1]
        toolsBlock.split('\n').forEach((line) => {
          const [tKey, tVal] = line.split(':').map((s) => s.trim())
          if (tKey && tVal) {
            // @ts-expect-error - dynamic assignment
            conf.permission[tKey] = tVal === 'true' ? 'allow' : 'deny'
          }
        })
      }
    }

    return conf
  }

  const generateContent = (c: AgentConfig): string => {
    return `---
description: ${c.description}
mode: ${c.mode}
model: ${c.model}
permission:
  write: ${c.permission.write}
  edit: ${c.permission.edit}
  bash: ${c.permission.bash}
  webfetch: ${c.permission.webfetch}
---
${c.systemPrompt}`
  }

  const handleSave = async () => {
    if (!editName()) return

    const content = generateContent(config())
    try {
      await createAgent(props.folder, { name: editName(), content })
      await fetchAgents()
      setIsEditing(false)
      setSelectedAgent(null)
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete agent ${name}?`)) return
    try {
      await deleteAgent(props.folder, name)
      await fetchAgents()
      if (selectedAgent() === name) {
        setSelectedAgent(null)
        setIsEditing(false)
      }
    } catch (err) {
      setError(String(err))
    }
  }

  const startEdit = (agent?: Agent) => {
    if (agent) {
      setEditName(agent.name)
      setConfig(parseAgent(agent.content))
    } else {
      setEditName('')
      setConfig({ ...DEFAULT_CONFIG })
    }
    setIsEditing(true)
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4">
      <div class="flex h-full w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-xl md:h-[600px] md:w-[800px] md:rounded-lg dark:border-[#30363d] dark:bg-[#0d1117]">
        <div class="flex items-center justify-between border-b border-gray-200 bg-[#f6f8fa] p-4 dark:border-[#30363d] dark:bg-[#010409]">
          <div class="flex items-center gap-3">
            <Show when={isEditing()}>
              <button
                onClick={() => setIsEditing(false)}
                class="text-gray-500 hover:text-gray-700 md:hidden dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </Show>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isEditing() ? (editName() ? 'Edit Agent' : 'New Agent') : 'Manage Agents'}
            </h2>
          </div>
          <button
            onClick={props.onClose}
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="relative flex flex-1 overflow-hidden">
          {/* Sidebar List */}
          <div
            class={`flex w-full flex-col border-r border-gray-200 bg-[#f6f8fa] md:w-64 dark:border-[#30363d] dark:bg-[#010409] ${isEditing() ? "hidden md:flex" : 'flex'} `}
          >
            <div class="p-2">
              <button
                onClick={() => startEdit()}
                class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                New Agent
              </button>
            </div>
            <div class="flex-1 space-y-1 overflow-y-auto p-2">
              <For each={agents()}>
                {(agent) => (
                  <div
                    class={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${selectedAgent() === agent.name ? "bg-white shadow-sm dark:bg-[#21262d]" : "hover:bg-gray-200 dark:hover:bg-[#161b22]"} `}
                    onClick={() => {
                      setSelectedAgent(agent.name)
                      startEdit(agent)
                    }}
                  >
                    <span class="truncate text-gray-700 dark:text-gray-200">{agent.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDelete(agent.name)
                      }}
                      class="p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Editor Area */}
          <div
            class={`flex-1 flex-col overflow-hidden bg-white dark:bg-[#0d1117] ${isEditing() ? 'flex' : "hidden md:flex"} `}
          >
            <Show
              when={isEditing()}
              fallback={
                <div class="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-400">
                  Select an agent to edit or create a new one
                </div>
              }
            >
              <div class="flex-1 space-y-6 overflow-y-auto p-6">
                {error() && (
                  <div class="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error()}
                  </div>
                )}

                <div>
                  <label for="agent-name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                    placeholder="my-agent"
                  />
                </div>

                <div>
                  <label
                    for="agent-description"
                    class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Description
                  </label>
                  <input
                    id="agent-description"
                    type="text"
                    value={config().description}
                    onInput={(e) => setConfig({ ...config(), description: e.currentTarget.value })}
                    class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="agent-model" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Model
                    </label>
                    <select
                      id="agent-model"
                      value={config().model}
                      onChange={(e) => setConfig({ ...config(), model: e.currentTarget.value })}
                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                    >
                      <option value="">Default</option>
                      <For each={models()}>{(model) => <option value={model}>{model}</option>}</For>
                    </select>
                  </div>
                  <div>
                    <label for="agent-mode" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Mode
                    </label>
                    <select
                      id="agent-mode"
                      value={config().mode}
                      onChange={(e) =>
                        setConfig({ ...config(), mode: e.currentTarget.value as 'primary' | 'subagent' })
                      }
                      class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                    >
                      <option value="primary">Primary</option>
                      <option value="subagent">Subagent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tool Permissions
                  </label>
                  <div class="space-y-2">
                    <For each={Object.keys(config().permission)}>
                      {(tool) => (
                        <label class="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={config().permission[tool as keyof AgentConfig['permission']] === 'allow'}
                            onChange={(e) =>
                              setConfig({
                                ...config(),
                                permission: {
                                  ...config().permission,
                                  [tool]: e.currentTarget.checked ? 'allow' : 'deny'
                                }
                              })
                            }
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span class="text-sm text-gray-700 capitalize dark:text-gray-300">{tool}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </div>

                <div class="flex min-h-[200px] flex-1 flex-col">
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt</label>
                  <textarea
                    value={config().systemPrompt}
                    onInput={(e) => setConfig({ ...config(), systemPrompt: e.currentTarget.value })}
                    class="w-full flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-2 border-t border-gray-200 bg-[#f6f8fa] p-4 dark:border-[#30363d] dark:bg-[#010409]">
                <button
                  onClick={() => setIsEditing(false)}
                  class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-[#21262d]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Save Agent
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
