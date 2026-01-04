import { Component, createEffect, createSignal, Match, Show, Switch } from 'solid-js'
import { ToolPart } from '../types'

interface Props {
  part: ToolPart
  folder: string
}

interface BashInput {
  command: string
}

interface EditInput {
  filePath: string
  oldString: string
  newString: string
}

interface WriteInput {
  filePath: string
  content: string
}

interface ReadInput {
  filePath: string
}

interface GrepInput {
  pattern: string
}

const ToolCall: Component<Props> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false)
  const [summaryEl, setSummaryEl] = createSignal<HTMLElement | undefined>(undefined)

  const openFile = (path: string) => {
    const event = new CustomEvent('open-file', {
      detail: { path, folder: props.folder },
      bubbles: true,
      composed: true
    })
    document.dispatchEvent(event)
  }

  const getToolSummaryText = (): string => {
    const tool = props.part.tool
    const input = props.part.state?.input

    switch (tool) {
      case 'edit': {
        const editInput = input as unknown as EditInput
        if (editInput?.filePath) {
          const oldLines = (editInput.oldString || '').split('\n').length
          const newLines = (editInput.newString || '').split('\n').length
          return `Edited ${editInput.filePath.split('/').pop()} +${newLines} -${oldLines}`
        }
        return 'Edited file'
      }

      case 'bash': {
        const bashInput = input as unknown as BashInput
        if (bashInput?.command) {
          const cmd = bashInput.command.split('\n')[0]
          return `$ ${cmd}`
        }
        return 'Run command'
      }

      case 'read': {
        const readInput = input as unknown as ReadInput
        if (readInput?.filePath) {
          return `Read ${readInput.filePath.split('/').pop()}`
        }
        return 'Read file'
      }

      case 'write': {
        const writeInput = input as unknown as WriteInput
        if (writeInput?.filePath) {
          return `Wrote ${writeInput.filePath.split('/').pop()}`
        }
        return 'Write file'
      }

      case 'grep':
      case 'glob': {
        const grepInput = input as unknown as GrepInput
        return `Search: ${grepInput?.pattern || ''}`
      }

      default:
        return tool || ''
    }
  }

  const getToolSummary = () => {
    const tool = props.part.tool
    const input = props.part.state?.input

    switch (tool) {
      case 'edit': {
        const editInput = input as unknown as EditInput
        if (editInput?.filePath) {
          const oldLines = (editInput.oldString || '').split('\n').length
          const newLines = (editInput.newString || '').split('\n').length
          return (
            <span class="flex items-center gap-2">
              <span>Edited</span>
              <button
                class="hover:underline cursor-pointer font-medium underline-offset-2 decoration-gray-400 dark:decoration-gray-500 text-gray-900 dark:text-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  openFile(editInput.filePath)
                }}
              >
                {editInput.filePath.split('/').pop()}
              </button>
              <span class="text-xs flex gap-1 font-mono opacity-80">
                <span class="text-green-600 dark:text-green-400">+{newLines}</span>
                <span class="text-red-600 dark:text-red-400">-{oldLines}</span>
              </span>
            </span>
          )
        }
        return 'Edited file'
      }

      case 'bash': {
        const bashInput = input as unknown as BashInput
        if (bashInput?.command) {
          const cmd = bashInput.command.split('\n')[0]
          return (
            <span
              class="font-mono text-xs truncate max-w-[200px] md:max-w-[400px] text-gray-600 dark:text-gray-300"
              title={bashInput.command}
            >
              $ {cmd}
            </span>
          )
        }
        return 'Run command'
      }

      case 'read': {
        const readInput = input as unknown as ReadInput
        if (readInput?.filePath) {
          return (
            <span class="flex items-center gap-1">
              <span>Read</span>
              <button
                class="hover:underline cursor-pointer font-medium underline-offset-2 decoration-gray-400 dark:decoration-gray-500 text-gray-900 dark:text-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  openFile(readInput.filePath)
                }}
              >
                {readInput.filePath.split('/').pop()}
              </button>
            </span>
          )
        }
        return 'Read file'
      }

      case 'write': {
        const writeInput = input as unknown as WriteInput
        if (writeInput?.filePath) {
          return (
            <span class="flex items-center gap-1">
              <span>Wrote</span>
              <button
                class="hover:underline cursor-pointer font-medium underline-offset-2 decoration-gray-400 dark:decoration-gray-500 text-gray-900 dark:text-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  openFile(writeInput.filePath)
                }}
              >
                {writeInput.filePath.split('/').pop()}
              </button>
            </span>
          )
        }
        return 'Write file'
      }

      case 'grep':
      case 'glob': {
        const grepInput = input as unknown as GrepInput
        const txt = `Search: ${grepInput?.pattern || ''}`
        return (
          <span
            class="font-sans text-sm truncate max-w-[200px] md:max-w-[400px] text-gray-600 dark:text-gray-300"
            title={txt}
          >
            {txt}
          </span>
        )
      }

      default:
        return (
          <span
            class="font-sans text-sm truncate max-w-[200px] md:max-w-[400px] text-gray-600 dark:text-gray-300"
            title={String(tool)}
          >
            {tool}
          </span>
        )
    }
  }

  // Type guard helpers or explicit casting inside JSX
  const getBashInput = () => props.part.state?.input as unknown as BashInput
  const getEditInput = () => props.part.state?.input as unknown as EditInput
  const getWriteInput = () => props.part.state?.input as unknown as WriteInput
  const getOutput = () => {
    const state = props.part.state
    return 'output' in state ? state.output : undefined
  }
  const getError = () => {
    const state = props.part.state
    return 'error' in state ? state.error : undefined
  }

  // when the summary element is mounted or updated, determine if it overflows and set title accordingly
  createEffect(() => {
    const el = summaryEl()
    if (!el) return
    // get the plain text summary
    const txt = getToolSummaryText()
    // small timeout to allow layout/calculations
    setTimeout(() => {
      if (el.scrollWidth > el.clientWidth) el.title = txt
      else el.removeAttribute('title')
    }, 0)
  })

  return (
    <div
      class={`text-sm transition-all duration-200 ${
        isExpanded()
          ? 'max-w-full rounded-lg border shadow-sm bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-[#30363d] my-1'
          : 'hover:bg-gray-50 dark:hover:bg-[#161b22]/50 rounded my-0.5'
      }`}
    >
      <div
        class={`flex cursor-pointer items-center justify-between py-1 px-2 select-none ${isExpanded() ? 'border-b border-gray-100 dark:border-[#30363d]' : ''}`}
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <div class="flex items-center gap-2 overflow-hidden">
          <span
            class="text-gray-400 dark:text-gray-500 text-[10px] transform transition-transform duration-200"
            classList={{ 'rotate-90': isExpanded() }}
          >
            ▶
          </span>
          <span
            class="text-gray-600 dark:text-gray-300 text-sm truncate block max-w-full"
            ref={(el: HTMLElement) => setSummaryEl(el)}
          >
            {getToolSummary()}
          </span>
        </div>
        <div class="px-2 flex-shrink-0">
          <Switch fallback={<span></span>}>
            <Match when={props.part.state?.status === 'error'}>
              <div class="text-red-600 dark:text-red-400" title="Error">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </Match>
            <Match when={props.part.state?.status === 'running' || props.part.state?.status === 'pending'}>
              <div class="text-blue-600 dark:text-blue-400 animate-spin" title="Running">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </Match>
          </Switch>
        </div>
      </div>

      <Show when={isExpanded()}>
        <div class="p-3 space-y-3 bg-gray-50/50 dark:bg-[#0d1117]/50 rounded-b-lg">
          <Switch
            fallback={
              <div>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Input
                </span>
                <div class="relative">
                  <pre class="mt-1 max-h-60 overflow-y-auto rounded-md bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] dark:text-gray-300 p-3 text-xs font-mono">
                    {JSON.stringify(props.part.state?.input, null, 2)}
                  </pre>
                  <button
                    class="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                    title="Copy"
                    onClick={(e) => {
                      e.stopPropagation()
                      try {
                        void navigator.clipboard.writeText(JSON.stringify(props.part.state?.input, null, 2) || '')
                      } catch (err) {
                        console.error('Copy failed', err)
                      }
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-gray-600 dark:text-gray-300"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.586A2 2 0 0015.414 5L12 1.586A2 2 0 0010.586 1H8z" />
                      <path d="M3 6a2 2 0 012-2h6v2H5v9h9v-4h2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                    </svg>
                  </button>
                </div>
              </div>
            }
          >
            <Match when={props.part.tool === 'bash'}>
              <div>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Command
                </span>
                <div class="mt-1 relative group">
                  <pre class="max-h-60 overflow-y-auto rounded-md bg-[#1e1e1e] text-gray-100 p-3 text-xs font-mono whitespace-pre-wrap border border-gray-800">
                    {getBashInput()?.command}
                  </pre>
                  <button
                    class="absolute top-1 right-1 p-1 rounded hover:bg-gray-800/40"
                    title="Copy"
                    onClick={(e) => {
                      e.stopPropagation()
                      try {
                        void navigator.clipboard.writeText(getBashInput()?.command || '')
                      } catch (err) {
                        console.error('Copy failed', err)
                      }
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-gray-200"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.586A2 2 0 0015.414 5L12 1.586A2 2 0 0010.586 1H8z" />
                      <path d="M3 6a2 2 0 012-2h6v2H5v9h9v-4h2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                    </svg>
                  </button>
                </div>
              </div>
            </Match>
            <Match when={props.part.tool === 'edit'}>
              <div class="space-y-3">
                <div>
                  <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File
                  </span>
                  <div class="mt-1">
                    <code class="rounded bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] dark:text-gray-300 px-2 py-1 text-xs font-mono">
                      {getEditInput()?.filePath}
                    </code>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div class="text-xs font-semibold text-red-500/80 uppercase tracking-wider mb-1">Replace</div>
                    <div class="relative">
                      <pre class="max-h-40 overflow-y-auto rounded-md bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-700 dark:text-red-300 p-2 text-xs font-mono whitespace-pre-wrap">
                        {getEditInput()?.oldString}
                      </pre>
                      <button
                        class="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                        title="Copy"
                        onClick={(e) => {
                          e.stopPropagation()
                          try {
                            void navigator.clipboard.writeText(getEditInput()?.oldString || '')
                          } catch (err) {
                            console.error('Copy failed', err)
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 text-red-600 dark:text-red-300"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.586A2 2 0 0015.414 5L12 1.586A2 2 0 0010.586 1H8z" />
                          <path d="M3 6a2 2 0 012-2h6v2H5v9h9v-4h2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs font-semibold text-green-500/80 uppercase tracking-wider mb-1">With</div>
                    <div class="relative">
                      <pre class="max-h-40 overflow-y-auto rounded-md bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 text-green-700 dark:text-green-300 p-2 text-xs font-mono whitespace-pre-wrap">
                        {getEditInput()?.newString}
                      </pre>
                      <button
                        class="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                        title="Copy"
                        onClick={(e) => {
                          e.stopPropagation()
                          try {
                            void navigator.clipboard.writeText(getEditInput()?.newString || '')
                          } catch (err) {
                            console.error('Copy failed', err)
                          }
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 text-green-600 dark:text-green-300"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.586A2 2 0 0015.414 5L12 1.586A2 2 0 0010.586 1H8z" />
                          <path d="M3 6a2 2 0 012-2h6v2H5v9h9v-4h2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Match>
            <Match when={props.part.tool === 'write'}>
              <div>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  File
                </span>
                <div class="mt-1 mb-2">
                  <code class="rounded bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] dark:text-gray-300 px-2 py-1 text-xs font-mono">
                    {getWriteInput()?.filePath}
                  </code>
                </div>
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Content
                </span>
                <pre class="mt-1 max-h-60 overflow-y-auto rounded-md bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] dark:text-gray-300 p-3 text-xs font-mono">
                  {getWriteInput()?.content}
                </pre>
              </div>
            </Match>
          </Switch>

          <Show when={getOutput() !== undefined}>
            <div>
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Output
              </span>
              <div class="relative">
                <pre class="mt-1 max-h-60 overflow-y-auto rounded-md bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] dark:text-gray-300 p-3 text-xs font-mono whitespace-pre-wrap">
                  {typeof getOutput() === 'string' ? getOutput() : JSON.stringify(getOutput(), null, 2)}
                </pre>
                <button
                  class="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
                  title="Copy"
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      void navigator.clipboard.writeText(getWriteInput()?.content || '')
                    } catch (err) {
                      console.error('Copy failed', err)
                    }
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 text-gray-600 dark:text-gray-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M8 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.586A2 2 0 0015.414 5L12 1.586A2 2 0 0010.586 1H8z" />
                    <path d="M3 6a2 2 0 012-2h6v2H5v9h9v-4h2v4a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                  </svg>
                </button>
              </div>
            </div>
          </Show>
          <Show when={getError()}>
            <div>
              <span class="text-xs font-semibold text-red-500 uppercase tracking-wider">Error</span>
              <pre class="mt-1 max-h-60 overflow-y-auto rounded-md bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 p-3 text-xs font-mono whitespace-pre-wrap">
                {typeof getError() === 'string' ? (getError() as string) : JSON.stringify(getError())}
              </pre>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default ToolCall
