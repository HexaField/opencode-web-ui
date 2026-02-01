import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'
import PlanDocument from './PlanDocument'

interface Props {
  plans: Task[]
  onSelectPlan: (id: string | null) => void
  onCreatePlan: () => Promise<void>
  onUpdatePlan: (id: string, description: string) => Promise<void>
  onCreateIssueFromItem: (title: string, planId: string) => Promise<Task>
  onOpenTask: (id: string) => void
}

export default function PlansList(props: Props) {
  const params = new URLSearchParams(window.location.search)
  const initialPlanId = params.get('planId') || null
  const [selectedPlanId, setSelectedPlanId] = createSignal<string | null>(initialPlanId)

  const selectedPlan = createMemo(() => props.plans.find((p) => p.id === selectedPlanId()))

  createEffect(() => {
    const url = new URL(window.location.href)
    const pid = selectedPlanId()
    if (pid) {
      url.searchParams.set('planId', pid)
    } else {
      url.searchParams.delete('planId')
    }
    window.history.replaceState({}, '', url)
  })

  const handleBack = () => {
    setSelectedPlanId(null)
  }

  return (
    <div class="flex h-full w-full flex-col">
      <Show when={selectedPlanId() === null}>
        <div class="mb-4 flex items-center justify-between border-b border-gray-200 p-4 dark:border-[#30363d]">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Plans</h2>
          <button
            onClick={props.onCreatePlan}
            class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Plan
          </button>
        </div>
        <div class="flex-1 space-y-2 overflow-auto p-4">
          <For each={props.plans}>
            {(plan) => (
              <div
                class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-500 dark:border-[#30363d] dark:bg-[#161b22] dark:hover:border-blue-400"
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <h3 class="font-medium text-gray-900 dark:text-gray-100">{plan.title}</h3>
                <p class="mt-1 line-clamp-2 text-sm text-gray-500">
                  {(plan.description || '').replace(/<!-- metadata[\s\S]*?-->/g, '')}
                </p>
                <div class="mt-2 flex gap-2 text-xs text-gray-400">
                  <span>{new Date(plan.updated_at).toLocaleDateString()}</span>
                  <span>{(plan.description?.match(/- \[ \]/g) || []).length} open items</span>
                </div>
              </div>
            )}
          </For>
          <Show when={props.plans.length === 0}>
            <div class="mt-10 text-center text-gray-500">No plans created yet. Click "New Plan" to get started.</div>
          </Show>
        </div>
      </Show>

      <Show when={selectedPlanId() !== null}>
        <Show
          when={selectedPlan()}
          fallback={
            <div>
              <div class="flex items-center gap-2 border-b border-gray-200 p-2 dark:border-[#30363d]">
                <button
                  onClick={handleBack}
                  class="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  ← Back to Plans
                </button>
              </div>
              <div class="p-8 text-center text-gray-500">Plan not found or loading...</div>
            </div>
          }
        >
          <div class="flex items-center gap-2 border-b border-gray-200 p-2 dark:border-[#30363d]">
            <button
              onClick={handleBack}
              class="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              ← Back to Plans
            </button>
          </div>
          <div class="flex-1 overflow-hidden">
            <PlanDocument
              plan={selectedPlan()!}
              onUpdateDescription={(id, desc) => props.onUpdatePlan(id, desc)}
              onCreateIssueFromItem={(title) => props.onCreateIssueFromItem(title, selectedPlanId()!)}
              onOpenIssue={props.onOpenTask}
            />
          </div>
        </Show>
      </Show>
    </div>
  )
}
