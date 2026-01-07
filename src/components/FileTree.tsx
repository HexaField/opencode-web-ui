import { createEffect, createSignal, For, Show } from 'solid-js'
import { listFiles } from '../api/files'
import { findRepos, getGitStatus } from '../api/git'

interface Entry {
  name: string
  isDirectory: boolean
  path: string
}

interface GitStatusMap {
  [path: string]: { x: string; y: string }
}

interface Props {
  rootPath: string
  onSelectFile: (path: string) => void
  selectedPath: string | null
  lastUpdated?: number
}

export default function FileTree(props: Props) {
  const [entries, setEntries] = createSignal<Entry[]>([])
  const [gitStatus, setGitStatus] = createSignal<GitStatusMap>({})
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
    void fetchGitStatus()
  })

  const fetchEntries = async (path: string): Promise<Entry[]> => {
    try {
      const { files } = await listFiles(path)
      return files
    } catch (e) {
      console.error(e)
      return []
    }
  }

  const fetchGitStatus = async () => {
    try {
      // Find all git repos
      let repos: string[] = []
      try {
        repos = await findRepos(props.rootPath)
      } catch (e) {
        void e
        // Fallback to checking root if finding repos fails or is not implemented
        repos = [props.rootPath]
      }
      if (repos.length === 0) {
        // If no repos found (and not even root is returned?), maybe try root
        repos = [props.rootPath]
      }

      const map: GitStatusMap = {}

      // Fetch status for all repos in parallel
      await Promise.all(
        repos.map(async (repoPath) => {
          try {
            const status = await getGitStatus(repoPath)
            if (Array.isArray(status)) {
              status.forEach((s) => {
                // Construct absolute path using / separator (standard for web/git relative paths)
                // We assume repoPath is absolute from findRepos/rootPath
                const absPath = repoPath + (repoPath.endsWith('/') ? '' : '/') + s.path
                map[absPath] = s
              })
            }
          } catch (e) {
            void e
            // Ignore error for individual repos (might not be git repo)
          }
        })
      )

      setGitStatus(map)
    } catch (e) {
      console.error('Failed to fetch git status for tree', e)
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
            gitStatus={gitStatus()}
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
  gitStatus: GitStatusMap
}) {
  const [children, setChildren] = createSignal<Entry[]>([])
  const isExpanded = () => props.expandedPaths.has(props.path)

  createEffect(() => {
    if (isExpanded() && props.isDirectory && children().length === 0) {
      listFiles(props.path)
        .then(({ files }) => setChildren(files))
        .catch(console.error)
    }
  })

  // Determine color based on git status
  const getStatusColor = () => {
    if (!props.isDirectory) {
      // File check
      const status = props.gitStatus[props.path]
      if (status) {
        // New: A or ? (untracked)
        if (status.x === 'A' || (status.x === '?' && status.y === '?')) {
          return 'text-green-600 dark:text-green-500'
        }
        // Modified: M
        if (status.x === 'M' || status.y === 'M') {
          return 'text-yellow-600 dark:text-yellow-500'
        }
      }
    } else {
      // Directory check - recursive (simplified here, but ideally we check if any child matches)
      // Since we have a flat map of git status files, we can check if any key in map starts with this dir path
      const dirPath = props.path + '/'
      let hasNew = false
      let hasModified = false

      for (const filePath in props.gitStatus) {
        if (filePath.startsWith(dirPath)) {
          const status = props.gitStatus[filePath]
          if (status.x === 'A' || (status.x === '?' && status.y === '?')) {
            hasNew = true
          }
          if (status.x === 'M' || status.y === 'M') {
            hasModified = true
          }
        }
      }

      if (hasNew) return 'text-green-600 dark:text-green-500'
      if (hasModified) return 'text-yellow-600 dark:text-yellow-500'
    }
    return ''
  }

  const statusColor = () => getStatusColor()

  return (
    <div>
      <div
        class={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#161b22] ${props.selectedPath === props.path ? 'bg-blue-100 dark:bg-[#1f6feb]/20' : ''}`}
        style={{ 'padding-left': `${props.level * 12 + 8}px` }}
        draggable={!props.isDirectory}
        onDragStart={(e) => {
          if (!props.isDirectory) {
            e.dataTransfer?.setData('text/plain', props.path)
            e.dataTransfer?.setData('application/opencode-file', props.path)
          }
        }}
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
        <span class={`truncate ${statusColor()}`}>{props.name}</span>
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
              gitStatus={props.gitStatus}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
