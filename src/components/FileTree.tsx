import { createEffect, createSignal, For, Show } from 'solid-js'

interface Entry {
  name: string
  isDirectory: boolean
  path: string
}

interface Props {
  rootPath: string
  onSelectFile: (path: string) => void
  selectedPath: string | null
  lastUpdated?: number
}

export default function FileTree(props: Props) {
  const [entries, setEntries] = createSignal<Entry[]>([])
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(
    (() => {
      try {
        const stored = localStorage.getItem('opencode_expanded_paths')
        return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
      } catch {
        return new Set()
      }
    })()
  )

  createEffect(() => {
    // Depend on lastUpdated to trigger refresh
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props.lastUpdated
    void fetchEntries(props.rootPath).then(setEntries)
  })

  const fetchEntries = async (path: string): Promise<Entry[]> => {
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`)
      if (!res.ok) return []
      return (await res.json()) as Entry[]
    } catch (e) {
      console.error(e)
      return []
    }
  }

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths())
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
    localStorage.setItem('opencode_expanded_paths', JSON.stringify(Array.from(newExpanded)))
  }

  return (
    <div class="overflow-y-auto h-full text-sm">
      <For each={entries()}>
        {(entry) => (
          <FileTreeNode
            path={entry.path}
            name={entry.name}
            isDirectory={entry.isDirectory}
            level={0}
            expandedPaths={expandedPaths()}
            onToggleExpand={toggleExpand}
            onSelectFile={props.onSelectFile}
            selectedPath={props.selectedPath}
          />
        )}
      </For>
    </div>
  )
}

function FileTreeNode(props: {
  path: string
  name: string
  isDirectory: boolean
  level: number
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  onSelectFile: (path: string) => void
  selectedPath: string | null
}) {
  const [children, setChildren] = createSignal<Entry[]>([])
  const isExpanded = () => props.expandedPaths.has(props.path)

  createEffect(() => {
    if (isExpanded() && props.isDirectory && children().length === 0) {
      fetch(`/api/fs/list?path=${encodeURIComponent(props.path)}`)
        .then((res) => res.json())
        .then(setChildren)
        .catch(console.error)
    }
  })

  return (
    <div>
      <div
        class={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#161b22] ${props.selectedPath === props.path ? 'bg-blue-100 dark:bg-[#1f6feb]/20' : ''}`}
        style={{ 'padding-left': `${props.level * 12 + 8}px` }}
        onClick={() => {
          if (props.isDirectory) {
            props.onToggleExpand(props.path)
          } else {
            props.onSelectFile(props.path)
          }
        }}
      >
        <span class="mr-1 text-gray-500 w-4 text-center inline-block">
          {props.isDirectory ? (isExpanded() ? '▼' : '▶') : '📄'}
        </span>
        <span class="truncate">{props.name}</span>
      </div>
      <Show when={isExpanded() && props.isDirectory}>
        <For each={children()}>
          {(entry) => (
            <FileTreeNode
              path={entry.path}
              name={entry.name}
              isDirectory={entry.isDirectory}
              level={props.level + 1}
              expandedPaths={props.expandedPaths}
              onToggleExpand={props.onToggleExpand}
              onSelectFile={props.onSelectFile}
              selectedPath={props.selectedPath}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
