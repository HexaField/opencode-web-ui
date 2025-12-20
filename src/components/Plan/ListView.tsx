import { createMemo, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
  onAddTask: (task: Partial<Task>) => void | Promise<void>
  onUpdateTask: (id: string, updates: Partial<Task>) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
}

interface TaskNode extends Task {
  children: TaskNode[]
}

export default function ListView(props: Props) {
  const [newTaskTitle, setNewTaskTitle] = createSignal('')

  const taskTree = createMemo(() => {
    const map = new Map<string, TaskNode>()
    const roots: TaskNode[] = []

    // First pass: create nodes
    props.tasks.forEach((task) => {
      map.set(task.id, { ...task, children: [] })
    })

    // Second pass: link children
    props.tasks.forEach((task) => {
      const node = map.get(task.id)!
      if (task.parent_id && map.has(task.parent_id)) {
        map.get(task.parent_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  })

  const handleAddTask = (e: Event) => {
    e.preventDefault()
    if (!newTaskTitle().trim()) return
    void props.onAddTask({ title: newTaskTitle(), status: 'todo' })
    setNewTaskTitle('')
  }

  const TaskItem = (itemProps: { task: TaskNode; level: number }) => {
    const [isEditing, setIsEditing] = createSignal(false)
    const [editTitle, setEditTitle] = createSignal(itemProps.task.title)
    const [isAddingSubtask, setIsAddingSubtask] = createSignal(false)
    const [subtaskTitle, setSubtaskTitle] = createSignal('')

    const handleSave = () => {
      if (editTitle().trim() !== itemProps.task.title) {
        void props.onUpdateTask(itemProps.task.id, { title: editTitle() })
      }
      setIsEditing(false)
    }

    const handleAddSubtask = (e: Event) => {
      e.preventDefault()
      if (!subtaskTitle().trim()) return
      void props.onAddTask({ title: subtaskTitle(), status: 'todo', parent_id: itemProps.task.id })
      setSubtaskTitle('')
      setIsAddingSubtask(false)
    }

    return (
      <div class="flex flex-col">
        <div class="flex items-center gap-2 py-1 group hover:bg-gray-50 dark:hover:bg-[#161b22] rounded px-2 -mx-2">
          <div class="w-2 h-2 rounded-full bg-gray-400 shrink-0 mt-1.5"></div>
          <div class="flex-1">
            <Show
              when={isEditing()}
              fallback={
                <div class="cursor-text" onClick={() => setIsEditing(true)}>
                  {itemProps.task.title}
                  <span class="ml-2 text-xs text-gray-400">{itemProps.task.status}</span>
                </div>
              }
            >
              <input
                type="text"
                value={editTitle()}
                onInput={(e) => setEditTitle(e.currentTarget.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                class="w-full px-2 py-1 bg-white dark:bg-[#0d1117] border border-blue-500 rounded outline-none"
                autofocus
              />
            </Show>
          </div>

          <div class="opacity-0 group-hover:opacity-100 flex items-center gap-2">
            <button
              class="text-gray-400 hover:text-blue-500"
              title="Add Subtask"
              onClick={() => setIsAddingSubtask(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button
              class="text-gray-400 hover:text-red-500"
              title="Delete"
              onClick={() => void props.onDeleteTask(itemProps.task.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <Show when={isAddingSubtask()}>
          <form onSubmit={handleAddSubtask} class="ml-6 mt-1 mb-2 flex gap-2">
            <input
              type="text"
              value={subtaskTitle()}
              onInput={(e) => setSubtaskTitle(e.currentTarget.value)}
              placeholder="Subtask title..."
              class="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] focus:outline-none focus:ring-1 focus:ring-blue-500"
              autofocus
            />
            <button type="submit" class="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              Add
            </button>
            <button
              type="button"
              class="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d] rounded"
              onClick={() => setIsAddingSubtask(false)}
            >
              Cancel
            </button>
          </form>
        </Show>

        <div class="ml-6 border-l border-gray-200 dark:border-[#30363d] pl-2">
          <For each={itemProps.task.children}>{(child) => <TaskItem task={child} level={itemProps.level + 1} />}</For>
        </div>
      </div>
    )
  }

  return (
    <div class="max-w-3xl mx-auto">
      <div class="mb-6">
        <form onSubmit={handleAddTask} class="flex gap-2">
          <input
            type="text"
            value={newTaskTitle()}
            onInput={(e) => setNewTaskTitle(e.currentTarget.value)}
            placeholder="Add a new task..."
            class="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </form>
      </div>

      <div class="space-y-1">
        <For each={taskTree()}>{(task) => <TaskItem task={task} level={0} />}</For>
        {props.tasks.length === 0 && <div class="text-center text-gray-500 py-10">No tasks yet. Add one above!</div>}
      </div>
    </div>
  )
}
