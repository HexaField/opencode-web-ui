import { createResource } from 'solid-js'
import { UpdateTaskRequest } from '../../../server/types'
import { authRadicle } from '../../api/git'
import { createTag, createTask, deleteTask, getTags, getTasks, updateTask } from '../../api/tasks'
import { Task } from '../../types'

export function createTasksStore(folder: string) {
  const [tasks, { mutate: mutateTasks, refetch: refetchTasks }] = createResource(() => folder, getTasks)
  const [tags, { mutate: mutateTags, refetch: refetchTags }] = createResource(() => folder, getTags)

  const addTask = async (task: {
    title: string
    description?: string
    status?: Task['status']
    parent_id?: string
    dependencies?: string[]
    kind?: 'task' | 'plan'
  }) => {
    try {
      const newTask = await createTask(folder, task)
      mutateTasks((prev) => (prev ? [newTask, ...prev] : [newTask]))
      return newTask
    } catch (e: any) {
      if (e.message && e.message.includes('Radicle authentication failed')) {
        const pass = prompt('Radicle passphrase required:')
        if (pass) {
          await authRadicle(pass)
          // Retry
          const newTask = await createTask(folder, task)
          mutateTasks((prev) => (prev ? [newTask, ...prev] : [newTask]))
          return newTask
        }
      }
      alert('Failed to add task: ' + String(e))
      throw e
    }
  }

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    await updateTask(folder, id, { status })
    mutateTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  const updateTaskDetails = async (id: string, updates: Partial<Task>) => {
    // Filter out fields that cannot be updated
    const { id: _, created_at: __, updated_at: ___, tags: ____, ...rest } = updates
    const validUpdates: UpdateTaskRequest['body'] = {
      ...rest,
      parent_id: rest.parent_id === null ? undefined : rest.parent_id
    }

    await updateTask(folder, id, validUpdates)
    mutateTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const removeTask = async (id: string) => {
    await deleteTask(folder, id)
    mutateTasks((prev) => prev?.filter((t) => t.id !== id))
  }

  const addTag = async (tag: { name: string; color: string }) => {
    const newTag = await createTag(folder, tag)
    mutateTags((prev) => (prev ? [...prev, newTag] : [newTag]))
    return newTag
  }

  return {
    tasks,
    tags,
    addTask,
    updateTaskStatus,
    updateTaskDetails,
    removeTask,
    addTag,
    refetchTasks,
    refetchTags
  }
}
