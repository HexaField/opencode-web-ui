import { createResource, createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { getTemplates, createProject } from '../../api/workspaces'
import { listModels } from '../../api/misc'

export default function NewProjectWizard(_props: { onCreated: (path: string) => void }) {
  const [isOpen, setIsOpen] = createSignal(false)

  const [templates] = createResource(getTemplates)
  const [models] = createResource(listModels)

  const [selectedTemplate, setSelectedTemplate] = createSignal<string>('monorepo')
  const [path, setPath] = createSignal('')
  const [selectedModel, setSelectedModel] = createSignal('')
  const [agentName, setAgentName] = createSignal('')
  const [prompt, setPrompt] = createSignal('')

  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await createProject(selectedTemplate(), path())

      const url = new URL(window.location.href)
      url.searchParams.delete('folder') // Ensure we don't duplicate
      url.searchParams.set('folder', res.path)

      if (prompt()) url.searchParams.set('initialPrompt', prompt())
      if (agentName()) url.searchParams.set('agent', agentName())
      if (selectedModel()) url.searchParams.set('model', selectedModel())

      // Open in new tab as requested
      window.open(url.toString(), '_blank')

      setIsOpen(false)
      // Optionally notify parent if we want to refresh recent list,
      // but onCreated usually triggers navigation in the parent.
      // Since we open new tab, we might just want to reload the list?
      // Current props.onOpen implementation navigates.
      // If we want to strictly follow "open in new tab", we shouldn't navigate here.
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        class="flex h-full min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-transparent p-6 text-gray-500 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mb-2 h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="text-lg font-medium">Create From Template</span>
      </button>

      <Show when={isOpen()}>
        <Portal>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-200 dark:bg-[#161b22] dark:ring-gray-700">
              <h2 class="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">Start New Project</h2>

              <div class="space-y-4">
                {/* Template */}
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Template</label>
                  <select
                    class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    value={selectedTemplate()}
                    onChange={(e) => setSelectedTemplate(e.currentTarget.value)}
                  >
                    <For each={templates()}>{(t) => <option value={t}>{t}</option>}</For>
                  </select>
                </div>

                {/* Path */}
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location (Full Path)
                  </label>
                  <input
                    type="text"
                    class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    value={path()}
                    onInput={(e) => setPath(e.currentTarget.value)}
                    placeholder="/Users/me/projects/new-app"
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  {/* Agent */}
                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Agent Name (Optional)
                    </label>
                    <input
                      type="text"
                      class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      value={agentName()}
                      onInput={(e) => setAgentName(e.currentTarget.value)}
                      placeholder="e.g. Architect"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Model (Optional)
                    </label>
                    <select
                      class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      value={selectedModel()}
                      onChange={(e) => setSelectedModel(e.currentTarget.value)}
                    >
                      <option value="">Default</option>
                      <For each={models()}>{(m) => <option value={m}>{m}</option>}</For>
                    </select>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Initial Prompt (Optional)
                  </label>
                  <textarea
                    class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    rows={4}
                    value={prompt()}
                    onInput={(e) => setPrompt(e.currentTarget.value)}
                    placeholder="Describe what you want to build or any initial instructions..."
                  />
                </div>

                {error() && (
                  <div class="rounded-md bg-red-50 p-2 text-sm text-red-500 dark:bg-red-900/20 dark:text-red-400">
                    {error()}
                  </div>
                )}

                <div class="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    class="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading() || !path()}
                    class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading() ? 'Creating...' : 'Create & Open'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
