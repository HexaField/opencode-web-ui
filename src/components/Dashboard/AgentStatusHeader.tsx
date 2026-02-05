import { createResource, createSignal, onCleanup } from 'solid-js'
import { getAgentStatus } from '../../api/agents'

export default function AgentStatusHeader() {
  const [status, { refetch }] = createResource(getAgentStatus)

  // Poll status every 2 seconds
  const interval = setInterval(() => refetch(), 2000)
  onCleanup(() => clearInterval(interval))

  return (
    <div class="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <span class="font-medium text-gray-500">System Status:</span>
      <div class="flex items-center gap-1.5">
        <span
          class={`h-2.5 w-2.5 rounded-full ${
            status()?.status === 'thinking' ? 'animate-pulse bg-green-500' : 'bg-gray-400'
          }`}
        />
        <span class="font-bold">
          {status()?.status === 'thinking' ? 'Thinking' : 'Idle'}
        </span>
      </div>
    </div>
  )
}
