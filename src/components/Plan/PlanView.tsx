import { createEffect, createSignal, Show } from 'solid-js'
import DAGView from './DAGView'
import KanbanView from './KanbanView'
import ListView from './ListView'
import TagsModal from './TagsModal'
import { createTasksStore } from './store'

export default function PlanView() {
  console.log('Rendering PlanView')
  const params = new URLSearchParams(window.location.search)
  const folder = params.get('folder') || ''

  const { tasks, tags, addTask, updateTaskStatus, updateTaskDetails, removeTask, addTag } = createTasksStore(folder)
  const [subView, setSubView] = createSignal<'list' | 'kanban' | 'dag'>('list')
  const [isTagsModalOpen, setIsTagsModalOpen] = createSignal(false)

  createEffect(() => {
    console.log('PlanView effect: subView=', subView(), 'tasks.loading=', tasks.loading, 'tasks()=', tasks())
  })

  return (
    <div id="plan-view-container" class="flex flex-col h-full w-full bg-white dark:bg-[#0d1117]">
      <div class="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-[#30363d] justify-between">
        <div class="flex items-center gap-2">
          <button
            class={`px-3 py-1 rounded text-sm font-medium ${
              subView() === 'list'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]'
            }`}
            onClick={() => setSubView('list')}
          >
            List
          </button>
          <button
            class={`px-3 py-1 rounded text-sm font-medium ${
              subView() === 'kanban'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]'
            }`}
            onClick={() => setSubView('kanban')}
          >
            Kanban
          </button>
          <button
            class={`px-3 py-1 rounded text-sm font-medium ${
              subView() === 'dag'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]'
            }`}
            onClick={() => setSubView('dag')}
          >
            DAG
          </button>
        </div>
        <button
          class="px-3 py-1 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
          onClick={() => setIsTagsModalOpen(true)}
        >
          Manage Tags
        </button>
      </div>

      <div class="flex-1 overflow-auto p-4">
        <Show when={tasks.loading}>
          <div class="flex items-center justify-center h-full text-gray-500">Loading tasks...</div>
        </Show>

        <Show when={!tasks.loading && tasks()}>
          <Show when={subView() === 'list'}>
            <ListView
              tasks={tasks()!}
              onAddTask={(t) => {
                void addTask(t)
              }}
              onUpdateTask={(id, u) => {
                void updateTaskDetails(id, u)
              }}
              onDeleteTask={(id) => {
                void removeTask(id)
              }}
            />
          </Show>
          <Show when={subView() === 'kanban'}>
            <KanbanView
              tasks={tasks()!}
              onUpdateStatus={(id, s) => {
                void updateTaskStatus(id, s)
              }}
            />
          </Show>
          <Show when={subView() === 'dag'}>
            <DAGView tasks={tasks()!} />
          </Show>
        </Show>
      </div>

      <TagsModal
        isOpen={isTagsModalOpen()}
        onClose={() => setIsTagsModalOpen(false)}
        tags={tags() || []}
        onCreateTag={(t) => {
          void addTag(t)
        }}
      />
    </div>
  )
}
