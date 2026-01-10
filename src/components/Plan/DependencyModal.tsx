import { createMemo, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  task: Task | null
  allTasks: Task[]
  onToggleDependency: (taskId: string, dependencyId: string, add: boolean) => void
}

export default function DependencyModal(props: Props) {
  const [search, setSearch] = createSignal('')

  const filteredTasks = createMemo(() => {
    if (!props.task) return []
    const query = search().toLowerCase()
    return props.allTasks.filter((t) => t.id !== props.task!.id && t.title.toLowerCase().includes(query))
  })

  return (
    <Show when={props.isOpen && props.task}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-[#30363d] dark:bg-[#0d1117]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Dependencies</h3>
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

          <input
            type="text"
            placeholder="Search tasks..."
            class="mb-4 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#161b22]"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            autofocus
          />

          <div class="flex-1 space-y-1 overflow-y-auto pr-1">
            <For each={filteredTasks()}>
              {(otherTask) => (
                <label class="flex cursor-pointer items-center gap-3 rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#161b22]">
                  <input
                    type="checkbox"
                    checked={props.task!.dependencies?.includes(otherTask.id)}
                    onChange={(e) => props.onToggleDependency(props.task!.id, otherTask.id, e.currentTarget.checked)}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">{otherTask.title}</span>
                </label>
              )}
            </For>
            <Show when={filteredTasks().length === 0}>
              <div class="py-4 text-center text-sm text-gray-500">No matching tasks found</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
