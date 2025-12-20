import { createSignal, For, Show } from 'solid-js'
import { Tag } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  tags: Tag[]
  onCreateTag: (tag: Partial<Tag>) => void | Promise<void>
}

export default function TagsModal(props: Props) {
  const [newTagName, setNewTagName] = createSignal('')
  const [newTagColor, setNewTagColor] = createSignal('#3b82f6') // Default blue

  const handleCreate = (e: Event) => {
    e.preventDefault()
    if (!newTagName().trim()) return
    void props.onCreateTag({ name: newTagName(), color: newTagColor() })
    setNewTagName('')
  }

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div class="bg-white dark:bg-[#161b22] rounded-lg shadow-xl w-96 max-w-full p-4 border border-gray-200 dark:border-[#30363d]">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold">Manage Tags</h2>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreate} class="mb-4 flex gap-2">
            <input
              type="color"
              value={newTagColor()}
              onInput={(e) => setNewTagColor(e.currentTarget.value)}
              class="w-10 h-10 p-1 rounded border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117]"
            />
            <input
              type="text"
              value={newTagName()}
              onInput={(e) => setNewTagName(e.currentTarget.value)}
              placeholder="New tag name..."
              class="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Add
            </button>
          </form>

          <div class="space-y-2 max-h-60 overflow-y-auto">
            <For each={props.tags}>
              {(tag) => (
                <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#0d1117] rounded border border-gray-200 dark:border-[#30363d]">
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded-full" style={{ 'background-color': tag.color }}></div>
                    <span>{tag.name}</span>
                  </div>
                </div>
              )}
            </For>
            {props.tags.length === 0 && <div class="text-center text-gray-500">No tags created yet.</div>}
          </div>
        </div>
      </div>
    </Show>
  )
}
