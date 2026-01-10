import { For } from 'solid-js'
import { Task, TaskStatus } from '../../types'

interface Props {
  tasks: Task[]
  onUpdateStatus: (id: string, status: TaskStatus) => void | Promise<void>
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' }
]

export default function KanbanView(props: Props) {
  console.log('KanbanView rendering')
  const handleDragStart = (e: DragEvent, taskId: string) => {
    e.dataTransfer?.setData('text/plain', taskId)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer?.getData('text/plain')
    if (taskId) {
      void props.onUpdateStatus(taskId, status)
    }
  }

  return (
    <div class="flex h-full gap-4 overflow-x-auto pb-4">
      <For each={COLUMNS}>
        {(column) => (
          <div
            class="flex min-w-[250px] flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50 dark:border-[#30363d] dark:bg-[#161b22]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div class="flex items-center justify-between border-b border-gray-200 p-3 font-medium dark:border-[#30363d]">
              <span>{column.title}</span>
              <span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:bg-[#21262d]">
                {props.tasks.filter((t) => t.status === column.id).length}
              </span>
            </div>
            <div class="flex-1 space-y-2 overflow-y-auto p-2">
              <For each={props.tasks.filter((t) => t.status === column.id)}>
                {(task) => (
                  <div
                    class="cursor-move rounded border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:hover:border-blue-500"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  >
                    <div class="text-sm">{task.title}</div>
                    {task.tags?.length > 0 && (
                      <div class="mt-2 flex flex-wrap gap-1">
                        <For each={task.tags}>
                          {(tag) => (
                            <span
                              class="rounded px-1.5 py-0.5 text-[10px] text-white"
                              style={{ 'background-color': tag.color || '#6b7280' }}
                            >
                              {tag.name}
                            </span>
                          )}
                        </For>
                      </div>
                    )}
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
