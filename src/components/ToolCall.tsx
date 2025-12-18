import { Component, Show } from 'solid-js'
import { ToolPart } from '../types'

interface Props {
  part: ToolPart
}

const ToolCall: Component<Props> = (props) => {
  return (
    <div class="my-2 rounded border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#161b22] p-1 text-sm">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-semibold text-gray-700 dark:text-gray-300">Tool: {props.part.tool}</span>
        <span
          class={`rounded px-2 py-0.5 text-xs ${
            props.part.state?.status === 'completed'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          {props.part.state?.status}
        </span>
      </div>

      <div class="space-y-2">
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
    </div>
  )
}

export default ToolCall
