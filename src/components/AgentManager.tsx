import { createEffect, createSignal, For, Show } from 'solid-js'

interface Agent {
  name: string
  content: string
}

interface AgentConfig {
  description: string
  mode: 'primary' | 'subagent'
  model: string
  tools: {
    write: boolean
    edit: boolean
    bash: boolean
    webfetch: boolean
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
  tools: {
    write: true,
    edit: true,
    bash: true,
    webfetch: true
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
    return fetch(`/api/agents?folder=${encodeURIComponent(props.folder)}`)
      .then((res) => res.json())
      .then((data) => setAgents(data as Agent[]))
      .catch((err) => setError(String(err)))
  }

  const fetchModels = () => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => setModels(data as string[]))
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

      // Simple tool parsing (assumes indented lines follow 'tools:')
      // This is a very basic parser, might need improvement for nested structures
    })

    // Better parsing for tools if they are in the frontmatter
    // We'll use a regex to find the tools block
    const toolsMatch = frontmatter.match(/tools:\n([\s\S]*?)(?=\n\w+:|$)/)
    if (toolsMatch) {
      const toolsBlock = toolsMatch[1]
      toolsBlock.split('\n').forEach((line) => {
        const [tKey, tVal] = line.split(':').map((s) => s.trim())
        if (tKey && tVal) {
          // @ts-expect-error - dynamic assignment
          conf.tools[tKey] = tVal === 'true'
        }
      })
    }

    return conf
  }

  const generateContent = (c: AgentConfig): string => {
    return `---
description: ${c.description}
mode: ${c.mode}
model: ${c.model}
tools:
  write: ${c.tools.write}
  edit: ${c.tools.edit}
  bash: ${c.tools.bash}
  webfetch: ${c.tools.webfetch}
---
${c.systemPrompt}`
  }

  const handleSave = async () => {
    if (!editName()) return

    const content = generateContent(config())
    try {
      const res = await fetch(`/api/agents?folder=${encodeURIComponent(props.folder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName(), content })
      })
      if (!res.ok) throw new Error(await res.text())
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
      const res = await fetch(`/api/agents/${name}?folder=${encodeURIComponent(props.folder)}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error(await res.text())
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
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
      <div class="bg-white dark:bg-[#0d1117] w-full h-full md:w-[800px] md:h-[600px] md:rounded-lg shadow-xl flex flex-col overflow-hidden border border-gray-200 dark:border-[#30363d]">
        <div class="p-4 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center bg-[#f6f8fa] dark:bg-[#010409]">
          <div class="flex items-center gap-3">
            <Show when={isEditing()}>
              <button
                onClick={() => setIsEditing(false)}
                class="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
            <h2 class="font-semibold text-lg text-gray-900 dark:text-gray-100">
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

        <div class="flex-1 flex overflow-hidden relative">
          {/* Sidebar List */}
          <div
            class={`
            w-full md:w-64 border-r border-gray-200 dark:border-[#30363d] flex flex-col bg-[#f6f8fa] dark:bg-[#010409]
            ${isEditing() ? 'hidden md:flex' : 'flex'}
          `}
          >
            <div class="p-2">
              <button
                onClick={() => startEdit()}
                class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                New Agent
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <For each={agents()}>
                {(agent) => (
                  <div
                    class={`
                      flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm group
                      ${selectedAgent() === agent.name ? 'bg-white dark:bg-[#21262d] shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-[#161b22]'}
                    `}
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
                      class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1"
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
            class={`
            flex-1 flex-col overflow-hidden bg-white dark:bg-[#0d1117]
            ${isEditing() ? 'flex' : 'hidden md:flex'}
          `}
          >
            <Show
              when={isEditing()}
              fallback={
                <div class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  Select an agent to edit or create a new one
                </div>
              }
            >
              <div class="flex-1 overflow-y-auto p-6 space-y-6">
                {error() && (
                  <div class="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                    {error()}
                  </div>
                )}

                <div>
                  <label for="agent-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="my-agent"
                  />
                </div>

                <div>
                  <label
                    for="agent-description"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Description
                  </label>
                  <input
                    id="agent-description"
                    type="text"
                    value={config().description}
                    onInput={(e) => setConfig({ ...config(), description: e.currentTarget.value })}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="agent-model" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model
                    </label>
                    <select
                      id="agent-model"
                      value={config().model}
                      onChange={(e) => setConfig({ ...config(), model: e.currentTarget.value })}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Default</option>
                      <For each={models()}>{(model) => <option value={model}>{model}</option>}</For>
                    </select>
                  </div>
                  <div>
                    <label for="agent-mode" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mode
                    </label>
                    <select
                      id="agent-mode"
                      value={config().mode}
                      onChange={(e) =>
                        setConfig({ ...config(), mode: e.currentTarget.value as 'primary' | 'subagent' })
                      }
                      class="w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="primary">Primary</option>
                      <option value="subagent">Subagent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tool Permissions
                  </label>
                  <div class="space-y-2">
                    <For each={Object.keys(config().tools)}>
                      {(tool) => (
                        <label class="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={config().tools[tool as keyof AgentConfig['tools']]}
                            onChange={(e) =>
                              setConfig({
                                ...config(),
                                tools: { ...config().tools, [tool]: e.currentTarget.checked }
                              })
                            }
                            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span class="text-sm text-gray-700 dark:text-gray-300 capitalize">{tool}</span>
                        </label>
                      )}
                    </For>
                  </div>
                </div>

                <div class="flex-1 flex flex-col min-h-[200px]">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
                  <textarea
                    value={config().systemPrompt}
                    onInput={(e) => setConfig({ ...config(), systemPrompt: e.currentTarget.value })}
                    class="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-[#30363d] rounded-md bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  />
                </div>
              </div>

              <div class="p-4 border-t border-gray-200 dark:border-[#30363d] flex justify-end gap-2 bg-[#f6f8fa] dark:bg-[#010409]">
                <button
                  onClick={() => setIsEditing(false)}
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
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
