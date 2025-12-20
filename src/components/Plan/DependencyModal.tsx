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
    return props.allTasks.filter(
      (t) => t.id !== props.task!.id && t.title.toLowerCase().includes(query)
    )
  })

  return (
    <Show when={props.isOpen && props.task}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="bg-white dark:bg-[#0d1117] rounded-lg shadow-xl w-full max-w-md p-4 max-h-[80vh] flex flex-col border border-gray-200 dark:border-[#30363d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex justify-between items-center mb-4">
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
            class="w-full px-3 py-2 border rounded-md mb-4 bg-gray-50 dark:bg-[#161b22] border-gray-300 dark:border-[#30363d] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            autofocus
          />

          <div class="overflow-y-auto flex-1 space-y-1 pr-1">
            <For each={filteredTasks()}>
              {(otherTask) => (
                <label class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-[#161b22] rounded cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={props.task!.dependencies?.includes(otherTask.id)}
                    onChange={(e) =>
                      props.onToggleDependency(props.task!.id, otherTask.id, e.currentTarget.checked)
                    }
                    class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">{otherTask.title}</span>
                </label>
              )}
            </For>
            <Show when={filteredTasks().length === 0}>
              <div class="text-center text-gray-500 py-4 text-sm">No matching tasks found</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
