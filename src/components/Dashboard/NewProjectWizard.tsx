import { createResource, createSignal, For } from 'solid-js'
import { getTemplates, createProject } from '../../api/workspaces'

export default function NewProjectWizard(props: { onCreated: (path: string) => void }) {
  const [templates] = createResource(getTemplates)
  const [selectedTemplate, setSelectedTemplate] = createSignal<string>('monorepo')
  const [path, setPath] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await createProject(selectedTemplate(), path())
      props.onCreated(res.path)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="h-full rounded-lg border border-gray-200 p-6 shadow-sm dark:border-gray-700">
      <h2 class="mb-4 text-xl font-bold">Start New Project</h2>
      <div class="flex flex-col gap-4">
        <div>
          <label class="mb-1 block text-sm font-medium">Template</label>
          <select
            class="w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
            value={selectedTemplate()}
            onChange={(e) => setSelectedTemplate(e.currentTarget.value)}
          >
            <For each={templates()}>{(t) => <option value={t}>{t}</option>}</For>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Location (Full Path)</label>
          <input
            type="text"
            class="w-full rounded border bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
            value={path()}
            onInput={(e) => setPath(e.currentTarget.value)}
            placeholder="/Users/me/dev/new-project"
          />
        </div>
        {error() && <div class="text-sm text-red-500">{error()}</div>}
        <button
          onClick={handleCreate}
          disabled={loading() || !path()}
          class="mt-auto w-full rounded bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading() ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  )
}
