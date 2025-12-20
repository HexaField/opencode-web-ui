import { createResource } from 'solid-js'
import { createTag, createTask, deleteTask, getTags, getTasks, updateTask } from '../../api/tasks'
import { Tag, Task } from '../../types'

export function createTasksStore(folder: string) {
  const [tasks, { mutate: mutateTasks, refetch: refetchTasks }] = createResource(() => folder, getTasks)
  const [tags, { mutate: mutateTags, refetch: refetchTags }] = createResource(() => folder, getTags)

  const addTask = async (task: Partial<Task>) => {
    const newTask = await createTask(folder, task)
    mutateTasks((prev) => (prev ? [newTask, ...prev] : [newTask]))
    return newTask
  }

  const updateTaskStatus = async (id: string, status: Task['status']) => {
    await updateTask(folder, id, { status })
    mutateTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  const updateTaskDetails = async (id: string, updates: Partial<Task>) => {
    await updateTask(folder, id, updates)
    mutateTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const removeTask = async (id: string) => {
    await deleteTask(folder, id)
    mutateTasks((prev) => prev?.filter((t) => t.id !== id))
  }

  const addTag = async (tag: Partial<Tag>) => {
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
