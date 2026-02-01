import { createMemo, createSignal, For, Show } from 'solid-js'
import { Task } from '../../types'

interface Props {
  task: Task
  isEditing?: boolean
  onUpdateDescription: (id: string, description: string) => Promise<void>
  onCreateIssueFromItem: (title: string) => Promise<Task>
  onOpenIssue: (id: string) => void
  onCancelEdit?: () => void
  onSaveEdit?: () => void
}

export default function TaskDescription(props: Props) {
  const [internalIsEditing, setInternalIsEditing] = createSignal(false)
  const [editContent, setEditContent] = createSignal('')

  const isEditing = () => (props.isEditing !== undefined ? props.isEditing : internalIsEditing())

  const lines = createMemo(() => (props.task.description || '').split('\n'))

  const startEditing = () => {
    setEditContent(props.task.description || '')
    setInternalIsEditing(true)
  }

  const saveEditing = async () => {
    await props.onUpdateDescription(props.task.id, editContent())
    setInternalIsEditing(false)
    props.onSaveEdit?.()
  }

  const cancelEditing = () => {
    setInternalIsEditing(false)
    props.onCancelEdit?.()
  }

  // Sync content when entering edit mode externally
  createMemo(() => {
    if (props.isEditing) {
      setEditContent(props.task.description || '')
    }
  })

  const handleCreateIssue = async (index: number, content: string, prefix: string) => {
    const title = content.trim()
    if (!title) return

    const newTask = await props.onCreateIssueFromItem(title)

    const newLines = [...lines()]
    newLines[index] = `${prefix}[${title}](#${newTask.id})`

    await props.onUpdateDescription(props.task.id, newLines.join('\n'))
  }

  return (
    <div class="relative w-full">
      <Show when={props.isEditing === undefined}>
        <div class="mb-2 flex items-center justify-end">
          <Show
            when={isEditing()}
            fallback={
              <button
                onClick={startEditing}
                class="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              >
                Edit Description
              </button>
            }
          >
            <div class="flex gap-2">
              <button
                onClick={cancelEditing}
                class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveEditing}
                class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={isEditing()}>
        <div class="flex flex-col gap-2">
          <textarea
            class="min-h-[200px] w-full resize-y rounded border border-gray-200 bg-white p-2 font-mono text-sm outline-none focus:border-blue-500 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-200"
            value={editContent()}
            onInput={(e) => setEditContent(e.currentTarget.value)}
          />
          <Show when={props.isEditing !== undefined}>
            <div class="flex justify-end gap-2">
              <button
                onClick={cancelEditing}
                class="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
              >
                Cancel
              </button>
              <button onClick={saveEditing} class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
                Save Description
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!isEditing()}>
        <div class="font-mono text-sm">
          <For each={lines()}>
            {(line, index) => {
              const listMatch = line.match(/^(\s*[-*]\s+(?:\[[ x]\]\s+)?)(.*)$/)

              if (listMatch) {
                const prefix = listMatch[1]
                const content = listMatch[2]
                const linkMatch = content.match(/^\[(.*)\]\(#([a-zA-Z0-9-]+)\)$/)

                if (linkMatch) {
                  const linkTitle = linkMatch[1]
                  const linkId = linkMatch[2]
                  return (
                    <div class="flex items-center gap-2 py-0.5 hover:bg-gray-50 dark:hover:bg-[#161b22]">
                      <span class="whitespace-pre text-gray-500">{prefix}</span>
                      <a
                        href="#"
                        class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={(e) => {
                          e.preventDefault()
                          props.onOpenIssue(linkId)
                        }}
                      >
                        {linkTitle} <span class="text-xs text-gray-500">#{linkId.slice(0, 6)}</span>
                      </a>
                    </div>
                  )
                }

                return (
                  <div class="group flex items-center gap-2 py-0.5 hover:bg-gray-50 dark:hover:bg-[#161b22]">
                    <span class="whitespace-pre text-gray-500">{prefix}</span>
                    <span class="flex-1 text-gray-800 dark:text-gray-200">{content}</span>
                    <button
                      class="invisible rounded bg-green-600 px-2 py-0.5 text-xs text-white opacity-0 transition-all group-hover:visible group-hover:opacity-100 hover:bg-green-700"
                      onClick={() => handleCreateIssue(index(), content, prefix)}
                      title="Convert to Issue"
                    >
                      Convert to Issue
                    </button>
                  </div>
                )
              }

              return <div class="min-h-[1.5em] py-0.5 whitespace-pre text-gray-800 dark:text-gray-200">{line}</div>
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
