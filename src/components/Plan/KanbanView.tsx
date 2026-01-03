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
            class="flex-1 min-w-[250px] flex flex-col bg-gray-50 dark:bg-[#161b22] rounded-lg border border-gray-200 dark:border-[#30363d]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div class="p-3 font-medium border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center">
              <span>{column.title}</span>
              <span class="text-xs text-gray-500 bg-gray-200 dark:bg-[#21262d] px-2 py-0.5 rounded-full">
                {props.tasks.filter((t) => t.status === column.id).length}
              </span>
            </div>
            <div class="flex-1 p-2 overflow-y-auto space-y-2">
              <For each={props.tasks.filter((t) => t.status === column.id)}>
                {(task) => (
                  <div
                    class="p-3 bg-white dark:bg-[#0d1117] rounded border border-gray-200 dark:border-[#30363d] shadow-sm cursor-move hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  >
                    <div class="text-sm">{task.title}</div>
                    {task.tags?.length > 0 && (
                      <div class="flex flex-wrap gap-1 mt-2">
                        <For each={task.tags}>
                          {(tag) => (
                            <span
                              class="text-[10px] px-1.5 py-0.5 rounded text-white"
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
