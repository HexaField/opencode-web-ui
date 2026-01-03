import { createMemo, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'
import DependencyModal from './DependencyModal'
import StartSessionModal from './StartSessionModal'

interface Props {
  tasks: Task[]
  onAddTask: (task: { title: string; status?: Task['status']; parent_id?: string }) => void | Promise<void>
  onUpdateTask: (id: string, updates: Partial<Task>) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onStartSession?: (sessionTitle: string, agentId: string, prompt: string, taskId?: string) => Promise<void>
}

interface TaskNode extends Task {
  children: TaskNode[]
}

export default function ListView(props: Props) {
  const [newTaskTitle, setNewTaskTitle] = createSignal('')
  const [draggedTaskId, setDraggedTaskId] = createSignal<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = createSignal<string | null>(null)
  const [dependencyModalTask, setDependencyModalTask] = createSignal<Task | null>(null)
  const [sessionModalTask, setSessionModalTask] = createSignal<Task | null>(null)

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

  const handleDragStart = (e: DragEvent, taskId: string) => {
    e.dataTransfer?.setData('text/plain', taskId)
    setDraggedTaskId(taskId)
    e.stopPropagation()
  }

  const isDescendant = (parentId: string, childId: string): boolean => {
    let current = props.tasks.find((t) => t.id === childId)
    while (current && current.parent_id) {
      if (current.parent_id === parentId) return true
      const nextParentId = current.parent_id
      current = props.tasks.find((t) => t.id === nextParentId)
    }
    return false
  }

  const handleDropOnTask = async (e: DragEvent, targetTaskId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const sourceTaskId = draggedTaskId()
    if (!sourceTaskId || sourceTaskId === targetTaskId) return

    if (isDescendant(sourceTaskId, targetTaskId)) {
      return
    }

    await props.onUpdateTask(sourceTaskId, { parent_id: targetTaskId })
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  const handleDropOnRoot = async (e: DragEvent) => {
    e.preventDefault()
    const sourceTaskId = draggedTaskId()
    if (!sourceTaskId) return

    await props.onUpdateTask(sourceTaskId, { parent_id: null })
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  const handleToggleDependency = async (taskId: string, dependencyId: string, add: boolean) => {
    const task = props.tasks.find((t) => t.id === taskId)
    if (!task) return

    const currentDeps = task.dependencies || []
    let newDeps: string[]
    if (add) {
      if (currentDeps.includes(dependencyId)) return
      newDeps = [...currentDeps, dependencyId]
    } else {
      newDeps = currentDeps.filter((id) => id !== dependencyId)
    }

    // Optimistically update the local state for the modal
    setDependencyModalTask((prev) => {
      if (!prev || prev.id !== taskId) return prev
      return { ...prev, dependencies: newDeps }
    })

    await props.onUpdateTask(taskId, { dependencies: newDeps })
  }

  const TaskItem = (itemProps: { task: TaskNode; level: number }) => {
    const [isEditing, setIsEditing] = createSignal(false)
    const [editTitle, setEditTitle] = createSignal(itemProps.task.title)
    const [isAddingSubtask, setIsAddingSubtask] = createSignal(false)
    const [subtaskTitle, setSubtaskTitle] = createSignal('')
    const [isExpanded, setIsExpanded] = createSignal(false)
    const [description, setDescription] = createSignal(itemProps.task.description || '')

    const handleSave = () => {
      if (editTitle().trim() !== itemProps.task.title) {
        void props.onUpdateTask(itemProps.task.id, { title: editTitle() })
      }
      setIsEditing(false)
    }

    const handleSaveDescription = () => {
      if (description() !== (itemProps.task.description || '')) {
        void props.onUpdateTask(itemProps.task.id, { description: description() })
      }
    }

    const handleAddSubtask = (e: Event) => {
      e.preventDefault()
      if (!subtaskTitle().trim()) return
      void props.onAddTask({ title: subtaskTitle(), status: 'todo', parent_id: itemProps.task.id })
      setSubtaskTitle('')
      setIsAddingSubtask(false)
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const sourceId = draggedTaskId()
      if (sourceId && sourceId !== itemProps.task.id && !isDescendant(sourceId, itemProps.task.id)) {
        setDragOverTaskId(itemProps.task.id)
      }
    }

    const onDragLeave = () => {
      if (dragOverTaskId() === itemProps.task.id) {
        setDragOverTaskId(null)
      }
    }

    const onDrop = (e: DragEvent) => {
      setDragOverTaskId(null)
      void handleDropOnTask(e, itemProps.task.id)
    }

    const handleTouchStart = () => {
      setDraggedTaskId(itemProps.task.id)
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target) return

      const taskElement = target.closest('[data-task-id]') as HTMLElement
      if (taskElement) {
        const id = taskElement.dataset.taskId
        if (id && id !== draggedTaskId() && !isDescendant(draggedTaskId()!, id)) {
          setDragOverTaskId(id)
        } else {
          if (dragOverTaskId() !== 'root') setDragOverTaskId(null)
        }
      } else {
        const rootZone = target.closest('[data-drop-zone="root"]')
        if (rootZone) {
          setDragOverTaskId('root')
        } else {
          setDragOverTaskId(null)
        }
      }
    }

    const handleTouchEnd = async () => {
      const sourceId = draggedTaskId()
      const targetId = dragOverTaskId()

      if (sourceId && targetId) {
        if (targetId === 'root') {
          await props.onUpdateTask(sourceId, { parent_id: null })
        } else if (sourceId !== targetId && !isDescendant(sourceId, targetId)) {
          await props.onUpdateTask(sourceId, { parent_id: targetId })
        }
      }
      setDraggedTaskId(null)
      setDragOverTaskId(null)
    }

    return (
      <div
        class={`flex flex-col rounded transition-colors ${dragOverTaskId() === itemProps.task.id ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''}`}
        draggable="true"
        data-task-id={itemProps.task.id}
        onDragStart={(e) => handleDragStart(e, itemProps.task.id)}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div class="flex items-center gap-2 py-1 group hover:bg-gray-50 dark:hover:bg-[#161b22] rounded px-2 -mx-2">
          <button
            class={`text-gray-400 hover:text-blue-500 transition-transform ${isExpanded() ? 'rotate-90' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded())
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
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

          <div class="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-2">
            <Show when={props.onStartSession}>
              <button
                class="text-gray-400 hover:text-green-500"
                title="Start Session"
                onClick={() => setSessionModalTask(itemProps.task)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </Show>
            <button
              class="text-gray-400 hover:text-blue-500"
              title="Manage Dependencies"
              onClick={() => setDependencyModalTask(itemProps.task)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
              </svg>
            </button>
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

          <div
            class="touch-none p-1 text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600 dark:hover:text-gray-300"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => void handleTouchEnd()}
            title="Drag to move"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        </div>

        <Show when={isExpanded()}>
          <div class="ml-8 mb-2 mr-2">
            <textarea
              class="w-full p-2 text-sm border rounded-md dark:bg-[#0d1117] dark:border-[#30363d] focus:ring-2 focus:ring-blue-500 outline-none resize-y"
              rows={3}
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              onBlur={handleSaveDescription}
              placeholder="Add a description..."
            />
          </div>
        </Show>

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

      <Show when={draggedTaskId()}>
        <div
          data-drop-zone="root"
          class={`mt-8 p-8 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
            dragOverTaskId() === 'root'
              ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverTaskId('root')
          }}
          onDragLeave={() => setDragOverTaskId(null)}
          onDrop={(e) => void handleDropOnRoot(e)}
        >
          Drag here to make a root task (remove parent)
        </div>
      </Show>

      <DependencyModal
        isOpen={!!dependencyModalTask()}
        onClose={() => setDependencyModalTask(null)}
        task={dependencyModalTask()}
        allTasks={props.tasks}
        onToggleDependency={(taskId, dependencyId, add) => void handleToggleDependency(taskId, dependencyId, add)}
      />

      <StartSessionModal
        isOpen={!!sessionModalTask()}
        onClose={() => setSessionModalTask(null)}
        task={sessionModalTask()}
        folder={new URLSearchParams(window.location.search).get('folder') || ''}
        onStartSession={props.onStartSession!}
      />
    </div>
  )
}
