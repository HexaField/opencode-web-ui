import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { Component, createSignal, Show } from 'solid-js'

interface Props {
  text: string
}

const ThoughtChain: Component<Props> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false)

  const content = () => props.text.replace(/^thought:\s*/, '')

  return (
    <div
      class={`text-sm transition-all duration-200 ${
        isExpanded()
          ? "my-1 max-w-full rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-[#30363d] dark:bg-[#161b22] dark:text-gray-100"
          : "my-0.5 rounded hover:bg-gray-50 dark:hover:bg-[#161b22]/50"
      }`}
    >
      <div
        class={`flex cursor-pointer items-center justify-between px-2 py-1 select-none ${
          isExpanded() ? "border-b border-gray-100 dark:border-[#30363d]" : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <div class="flex items-center gap-2 overflow-hidden">
          <span
            class="transform text-[10px] text-gray-400 transition-transform duration-200 dark:text-gray-500"
            classList={{ 'rotate-90': isExpanded() }}
          >
            ▶
          </span>
          <span class="block max-w-full truncate text-sm text-gray-600 dark:text-gray-300">Thought Process</span>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div class="overflow-x-auto rounded-b-lg bg-gray-50/50 p-3 dark:bg-[#0d1117]/50">
          <div
            class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            innerHTML={DOMPurify.sanitize(marked.parse(content(), { async: false }))}
          />
        </div>
      </Show>
    </div>
  )
}

export default ThoughtChain
