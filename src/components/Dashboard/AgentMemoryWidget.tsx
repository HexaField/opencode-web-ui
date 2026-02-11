import { createResource, createSignal, Show, For } from 'solid-js'
import { getAgentMemory, saveAgentMemory } from '../../api/agents'
import { searchKnowledgeBase } from '../../api/misc'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default function AgentMemoryWidget() {
  const [memory, { refetch }] = createResource(getAgentMemory)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [searchResults, setSearchResults] = createSignal<any[]>([])
  const [isSearching, setIsSearching] = createSignal(false)
  const [isEditing, setIsEditing] = createSignal(false)
  const [editContent, setEditContent] = createSignal('')

  const handleSearch = async (e: Event) => {
    e.preventDefault()
    if (!searchQuery().trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchKnowledgeBase(searchQuery())
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }

  const handleEdit = () => {
    setEditContent(memory()?.lessons || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      await saveAgentMemory(editContent())
      refetch()
      setIsEditing(false)
    } catch (e) {
      console.error('Failed to save memory', e)
      alert('Failed to save changes')
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <div class="flex h-full flex-col gap-4 rounded-lg border border-gray-200 p-6 shadow-sm dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">Memory & Lessons</h2>
        <Show when={!isEditing()}>
          <button
            onClick={handleEdit}
            class="rounded px-2 py-1 text-xs text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
          >
            Edit
          </button>
        </Show>
      </div>

      <Show when={isEditing()}>
        <div class="flex flex-1 flex-col gap-2">
          <textarea
            class="flex-1 resize-none rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
            value={editContent()}
            onInput={(e) => setEditContent(e.currentTarget.value)}
          />
          <div class="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              class="rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button onClick={handleSave} class="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600">
              Save Changes
            </button>
          </div>
        </div>
      </Show>

      <Show when={!isEditing()}>
        {/* Search Input */}
        <form onSubmit={handleSearch} class="flex gap-2">
          <input
            type="text"
            placeholder="Search knowledge base..."
            class="w-full rounded border bg-white px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={searchQuery()}
            onInput={(e) => {
              setSearchQuery(e.currentTarget.value)
              if (!e.currentTarget.value) setSearchResults([])
            }}
          />
        </form>

        <div class="flex-1 overflow-auto text-sm text-gray-600 dark:text-gray-300">
          <Show when={searchQuery() && searchResults().length > 0}>
            <h3 class="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">Search Results</h3>
            <div class="space-y-4">
              <For each={searchResults()}>
                {(result) => (
                  <div class="rounded border bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div class="mb-1 font-mono text-xs text-gray-500">
                      {(result.metadata?.type || 'unknown').toUpperCase()}
                      {result.metadata?.workspace ? ` • ${result.metadata.workspace}` : ''}
                      {result.metadata?.source ? ` • ${result.metadata.source}` : ''}
                    </div>
                    <div class="prose prose-sm dark:prose-invert max-w-none">{result.content.substring(0, 300)}...</div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={!searchQuery()}>
            {memory.loading ? (
              <p>Loading memory...</p>
            ) : memory()?.lessons ? (
              <div
                class="prose prose-sm dark:prose-invert"
                innerHTML={DOMPurify.sanitize(marked.parse(memory()?.lessons || '') as string)}
              />
            ) : (
              <p class="text-gray-400 italic">No lessons learned yet.</p>
            )}
          </Show>

          <Show when={searchQuery() && !isSearching() && searchResults().length === 0}>
            <p class="mt-4 text-center text-xs text-gray-400 italic">No results found.</p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
