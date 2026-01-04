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
          ? 'max-w-full rounded-lg border shadow-sm bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-[#30363d] my-1'
          : 'hover:bg-gray-50 dark:hover:bg-[#161b22]/50 rounded my-0.5'
      }`}
    >
      <div
        class={`flex cursor-pointer items-center justify-between py-1 px-2 select-none ${
          isExpanded() ? 'border-b border-gray-100 dark:border-[#30363d]' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <div class="flex items-center gap-2 overflow-hidden">
          <span
            class="text-gray-400 dark:text-gray-500 text-[10px] transform transition-transform duration-200"
            classList={{ 'rotate-90': isExpanded() }}
          >
            ▶
          </span>
          <span class="text-gray-600 dark:text-gray-300 text-sm truncate block max-w-full">Thought Process</span>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div class="p-3 bg-gray-50/50 dark:bg-[#0d1117]/50 rounded-b-lg overflow-x-auto">
          <div
            class="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sm"
            innerHTML={DOMPurify.sanitize(marked.parse(content(), { async: false }))}
          />
        </div>
      </Show>
    </div>
  )
}

export default ThoughtChain
