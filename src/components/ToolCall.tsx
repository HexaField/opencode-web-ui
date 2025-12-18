import { Component, createSignal, Match, Show, Switch } from 'solid-js'
import { ToolPart } from '../types'

interface Props {
  part: ToolPart
}

const ToolCall: Component<Props> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false)

  return (
    <div
      class={`text-sm ${
        isExpanded()
          ? 'max-w-[85%] md:max-w-[75%] rounded-xl px-2 py-1 border shadow-sm bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-[#30363d] rounded-bl-sm'
          : ''
      }`}
    >
      <div
        class="flex cursor-pointer items-center justify-between py-0.5 px-1 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded"
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <div class="flex items-center gap-2">
          <span class="text-gray-500 dark:text-gray-400 text-xs">{isExpanded() ? '▼' : '▶'}</span>
          <span class="text-gray-500 dark:text-gray-400">Tool: {props.part.tool}</span>
        </div>
        <div class="px-2">
          <Switch
            fallback={<span class="text-yellow-600 dark:text-yellow-400 text-xs">{props.part.state?.status}</span>}
          >
            <Match when={props.part.state?.status === 'completed'}>
              <svg
                class="w-4 h-4 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <title>Completed</title>
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </Match>
            <Match when={props.part.state?.status === 'error'}>
              <svg
                class="w-4 h-4 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <title>Error</title>
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Match>
            <Match when={props.part.state?.status === 'running' || props.part.state?.status === 'pending'}>
              <svg
                class="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <title>Running</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </Match>
          </Switch>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div class="mt-1 ml-2 border-l-2 border-gray-200 dark:border-[#30363d] pl-2 space-y-2">
          <Show when={props.part.tool === 'list'}>
            <div>
              <span class="font-medium text-gray-600 dark:text-gray-400">Path:</span>{' '}
              <code class="rounded bg-gray-100 dark:bg-[#0d1117] dark:text-gray-300 px-1">
                {props.part.state?.input?.path as string}
              </code>
            </div>
          </Show>

          <Show when={props.part.tool === 'write'}>
            <div>
              <span class="font-medium text-gray-600 dark:text-gray-400">File:</span>{' '}
              <code class="rounded bg-gray-100 dark:bg-[#0d1117] dark:text-gray-300 px-1">
                {props.part.state?.input?.filePath as string}
              </code>
            </div>
            <Show when={props.part.state?.input?.content}>
              <div class="mt-1">
                <div class="mb-1 font-medium text-gray-600 dark:text-gray-400">Content:</div>
                <pre class="max-h-32 overflow-y-auto rounded bg-gray-100 dark:bg-[#0d1117] dark:text-gray-300 p-2 text-xs">
                  {props.part.state?.input?.content as string}
                </pre>
              </div>
            </Show>
          </Show>

          <Show when={props.part.tool !== 'list' && props.part.tool !== 'write'}>
            <div>
              <span class="font-medium text-gray-600 dark:text-gray-400">Input:</span>
              <pre class="mt-1 max-h-32 overflow-y-auto rounded bg-gray-100 dark:bg-[#0d1117] dark:text-gray-300 p-2 text-xs">
                {JSON.stringify(props.part.state?.input, null, 2)}
              </pre>
            </div>
          </Show>

          <Show when={props.part.state?.status === 'completed' ? props.part.state : undefined}>
            {(state) => (
              <div class="mt-2 border-t border-gray-200 dark:border-[#30363d] pt-2">
                <span class="font-medium text-gray-600 dark:text-gray-400">Output:</span>
                <pre class="mt-1 max-h-32 overflow-y-auto rounded bg-gray-100 dark:bg-[#0d1117] dark:text-gray-300 p-2 text-xs">
                  {state().output}
                </pre>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default ToolCall
