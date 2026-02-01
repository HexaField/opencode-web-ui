import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import DAGView from './DAGView'
import KanbanView from './KanbanView'
import ListView from './ListView'
import PlansList from './PlansList'
import TagsModal from './TagsModal'
import { createTasksStore } from './store'

interface Props {
  onStartSession?: (sessionTitle: string, agentId: string, prompt: string, taskId?: string) => Promise<void>
}

export default function PlanView(props: Props) {
  const params = new URLSearchParams(window.location.search)
  const folder = params.get('folder') || ''

  const { tasks, tags, addTask, updateTaskStatus, updateTaskDetails, removeTask, addTag } = createTasksStore(folder)

  const initialTab = (params.get('planTab') as 'plans' | 'list' | 'kanban' | 'dag') || 'list'
  const [currentTab, setCurrentTab] = createSignal<'plans' | 'list' | 'kanban' | 'dag'>(initialTab)
  const [isTagsModalOpen, setIsTagsModalOpen] = createSignal(false)

  createEffect(() => {
    const url = new URL(window.location.href)
    const tab = currentTab()
    if (tab !== 'list') {
      url.searchParams.set('planTab', tab)
    } else {
      url.searchParams.delete('planTab')
    }
    window.history.replaceState({}, '', url)
  })

  const plans = createMemo(() => tasks()?.filter((t) => t.kind === 'plan') || [])
  const workTasks = createMemo(() => tasks()?.filter((t) => t.kind !== 'plan') || [])

  const handleCreatePlan = async () => {
    const title = prompt('Enter plan title')
    if (title) {
      await addTask({
        title,
        description: '# ' + title + '\n\n- [ ] item 1',
        kind: 'plan'
      })
    }
  }

  const handleCreateIssueFromPlan = async (title: string, parentPlanId: string) => {
    const newTask = await addTask({
      title,
      parent_id: parentPlanId,
      status: 'todo',
      kind: 'task'
    })
    return newTask
  }

  return (
    <div id="plan-view-container" class="flex h-full w-full flex-col bg-white dark:bg-[#0d1117]">
      <div class="flex items-center justify-between gap-2 overflow-x-auto border-b border-gray-200 p-2 dark:border-[#30363d]">
        <div class="flex items-center gap-2">
          <button
            class={`rounded px-3 py-1 text-sm font-medium whitespace-nowrap ${
              currentTab() === 'list'
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
            }`}
            onClick={() => setCurrentTab('list')}
          >
            List
          </button>
          <button
            class={`rounded px-3 py-1 text-sm font-medium whitespace-nowrap ${
              currentTab() === 'kanban'
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
            }`}
            onClick={() => setCurrentTab('kanban')}
          >
            Kanban
          </button>
          <button
            class={`rounded px-3 py-1 text-sm font-medium whitespace-nowrap ${
              currentTab() === 'dag'
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
            }`}
            onClick={() => setCurrentTab('dag')}
          >
            DAG
          </button>
          <button
            data-testid="plan-view-plans-tab"
            class={`rounded px-3 py-1 text-sm font-medium whitespace-nowrap ${
              currentTab() === 'plans'
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
            }`}
            onClick={() => setCurrentTab('plans')}
          >
            Plans
          </button>
        </div>
        <button
          class="rounded px-3 py-1 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
          onClick={() => setIsTagsModalOpen(true)}
        >
          Manage Tags
        </button>
      </div>

      <div class="relative flex-1 overflow-hidden">
        <Show when={tasks.loading}>
          <div class="flex h-full items-center justify-center text-gray-500">Loading tasks...</div>
        </Show>

        <Show when={!tasks.loading && tasks()}>
          <div class={`absolute inset-0 overflow-auto ${currentTab() === 'plans' ? '' : 'p-4'}`}>
            <Show when={currentTab() === 'list'}>
              <ListView
                tasks={workTasks()}
                onAddTask={(t) => addTask(t)}
                onUpdateTask={(id, u) => {
                  void updateTaskDetails(id, u)
                }}
                onDeleteTask={(id) => {
                  void removeTask(id)
                }}
                onStartSession={props.onStartSession}
                onOpenTask={(id) => {
                  console.log('Open task', id)
                  // In list view we are already here, maybe scroll into view?
                  const el = document.querySelector(`[data-task-id="${id}"]`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    // highlight
                    el.classList.add('ring-2', 'ring-blue-500')
                    setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500'), 2000)
                  }
                }}
              />
            </Show>
            <Show when={currentTab() === 'kanban'}>
              <KanbanView
                tasks={workTasks()}
                onUpdateStatus={(id, s) => {
                  void updateTaskStatus(id, s)
                }}
              />
            </Show>
            <Show when={currentTab() === 'dag'}>
              <DAGView tasks={workTasks()} />
            </Show>
            <Show when={currentTab() === 'plans'}>
              <PlansList
                plans={plans()}
                onSelectPlan={() => {}}
                onCreatePlan={handleCreatePlan}
                onUpdatePlan={(id, desc) => updateTaskDetails(id, { description: desc })}
                onCreateIssueFromItem={handleCreateIssueFromPlan}
                onOpenTask={(taskId) => {
                  setCurrentTab('list')
                  // Ideally we would highlight the task here, but just switching to list is a start
                  console.log('Opening task', taskId)
                }}
              />
            </Show>
          </div>
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
