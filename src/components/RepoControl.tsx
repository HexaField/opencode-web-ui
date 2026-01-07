import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { getFileDiff } from '../api/files'
import {
  commit,
  generateCommitMessage,
  getAheadBehind,
  getCurrentBranch,
  getGitStatus,
  push,
  stageFiles,
  unstageFiles
} from '../api/git'

interface GitFileStatus {
  path: string
  x: string
  y: string
}

interface Props {
  repoPath: string
  rootDir: string // The root workspace folder, for relative path display
}

export default function RepoControl(props: Props) {
  const [gitFiles, setGitFiles] = createSignal<GitFileStatus[]>([])
  const [currentBranch, setCurrentBranch] = createSignal('')
  const [commitMessage, setCommitMessage] = createSignal('')
  const [commitError, setCommitError] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [aheadBehind, setAheadBehind] = createSignal<{ ahead: number; behind: number }>({ ahead: 0, behind: 0 })

  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [diffs, setDiffs] = createSignal<Record<string, string | null>>({})

  // Compute display name for the repo
  // If repoPath is same as rootDir, show "Root" or just "/"
  // Else show relative path
  const repoName = () => {
    if (props.repoPath === props.rootDir) return 'Root Repository'
    return props.repoPath.substring(props.rootDir.length + 1)
  }

  const fetchStatus = async () => {
    try {
      const data = await getGitStatus(props.repoPath)
      if (Array.isArray(data)) setGitFiles(data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchBranches = async () => {
    try {
      const data2 = await getCurrentBranch(props.repoPath)
      if (data2.branch) setCurrentBranch(data2.branch)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchAheadBehind = async () => {
    try {
      const res = await getAheadBehind(props.repoPath, 'origin', currentBranch())
      if (res && typeof res.ahead === 'number' && typeof res.behind === 'number') {
        setAheadBehind({ ahead: res.ahead, behind: res.behind })
      }
    } catch (err) {
      // ignore errors
      console.error('Failed to fetch ahead/behind', err)
    }
  }

  // Periodic refresh for pull count (behind). Run every minute.
  let intervalId: number | undefined
  // Handler for global git updates dispatched by api/git
  const handleGitUpdated = () => {
    // Refresh status, branches and ahead/behind counts when git operations occur elsewhere
    void fetchStatus()
    void fetchBranches()
    void fetchAheadBehind()
  }

  onMount(() => {
    void fetchStatus()
    void fetchBranches()
    void fetchAheadBehind()

    intervalId = window.setInterval(() => {
      void fetchAheadBehind()
    }, 60 * 1000)
    try {
      window.addEventListener('git-updated', handleGitUpdated)
    } catch (err) {
      void err
    }
  })
  onCleanup(() => {
    if (intervalId) clearInterval(intervalId)
    try {
      window.removeEventListener('git-updated', handleGitUpdated)
    } catch (err) {
      void err
    }
  })

  // Watch for branch changes to update ahead/behind
  createEffect(() => {
    if (currentBranch()) {
      void fetchAheadBehind()
    }
  })

  const handleStage = async (file: string) => {
    await stageFiles(props.repoPath, [file])
    await fetchStatus()
  }

  const handleStageAll = async () => {
    const files = unstagedFiles().map((f) => f.path)
    if (files.length === 0) return
    await stageFiles(props.repoPath, files)
    await fetchStatus()
  }

  const handleUnstage = async (file: string) => {
    await unstageFiles(props.repoPath, [file])
    await fetchStatus()
  }

  const handleUnstageAll = async () => {
    const files = stagedFiles().map((f) => f.path)
    if (files.length === 0) return
    await unstageFiles(props.repoPath, files)
    await fetchStatus()
  }

  const handleCommit = async () => {
    if (!commitMessage()) return
    setCommitError('')
    try {
      await commit(props.repoPath, commitMessage())
      setCommitMessage('')
      await fetchStatus()
      await fetchAheadBehind()
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleGenerateMessage = async () => {
    setIsGenerating(true)
    try {
      const { message } = await generateCommitMessage(props.repoPath)
      setCommitMessage(message)
    } catch (e) {
      console.error(e)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePush = async () => {
    try {
      await push(props.repoPath)
      await fetchAheadBehind()
    } catch (e) {
      alert('Failed to push: ' + String(e))
    }
  }

  const toggleDiff = async (file: string) => {
    if (expanded()[file]) {
      setExpanded((p) => ({ ...p, [file]: false }))
    } else {
      setExpanded((p) => ({ ...p, [file]: true }))
      if (!diffs()[file]) {
        try {
          // getFileDiff API needs to support folder/repoPath if it doesn't already?
          // Actually getFileDiff probably runs git diff.
          // Let's check getFileDiff implementation. Assuming it takes folder or we need to pass absolute path?
          // Looking at API usage in DiffView, it was getFileDiff(props.folder, file)
          // Wait, getFileDiff signature in api/files.ts handles folder.
          // So we pass props.repoPath.
          const diff = await getFileDiff(props.repoPath, file)
          setDiffs((p) => ({ ...p, [file]: diff.diff }))
        } catch (e) {
          console.error(e)
        }
      }
    }
  }

  const stagedFiles = () => gitFiles().filter((f) => f.x !== ' ' && f.x !== '?')
  const unstagedFiles = () => gitFiles().filter((f) => f.x === ' ' || f.x === '?' || (f.x !== ' ' && f.y !== ' '))

  return (
    <div class="flex flex-col h-full border-b border-gray-200 dark:border-[#30363d] last:border-b-0 space-y-4">
      <div class="p-2 bg-[#f6f8fa] dark:bg-[#161b22] text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
        <span>{repoName()}</span>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-gray-500">{currentBranch() || '...'}</span>
          <div class="flex space-x-1">
            {aheadBehind().behind > 0 && <span class="text-red-500 dark:text-red-400">↓{aheadBehind().behind}</span>}
            {aheadBehind().ahead > 0 && <span class="text-green-500 dark:text-green-400">↑{aheadBehind().ahead}</span>}
          </div>
          <button
            onClick={() => void handlePush()}
            class="p-1 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded text-gray-600 dark:text-gray-300"
            title="Push"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="px-4">
        <textarea
          class="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-[#30363d] text-gray-800 dark:text-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
          placeholder="Message (⌘Enter to commit)"
          value={commitMessage()}
          onInput={(e) => setCommitMessage(e.currentTarget.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              void handleCommit()
            }
          }}
        />
        <div class="flex justify-between mt-2">
          <button
            onClick={() => void handleGenerateMessage()}
            disabled={isGenerating()}
            class={`px-3 py-1 bg-gray-200 dark:bg-[#21262d] text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-[#30363d] flex items-center space-x-1 ${isGenerating() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Show when={isGenerating()} fallback={<span>✨ AI Generate</span>}>
              <span>Generat...</span>
            </Show>
          </button>
          <button
            onClick={() => void handleCommit()}
            disabled={!commitMessage() || stagedFiles().length === 0}
            class="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Commit
          </button>
        </div>
        <Show when={commitError()}>
          <div class="mt-2 p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/10 rounded border border-red-200 dark:border-red-900/30 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
            {commitError()}
          </div>
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">Staged Changes</h3>
            <div class="flex items-center space-x-2">
              <span class="text-xs text-gray-500">{stagedFiles().length}</span>
              <button
                onClick={() => void handleUnstageAll()}
                class="text-gray-500 hover:text-gray-700 dark:hover:text-white"
                title="Unstage All Changes"
              >
                -
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <For each={stagedFiles()}>
              {(file) => (
                <div class="group">
                  <div class="flex items-center justify-between p-2 bg-white dark:bg-[#161b22] rounded border border-transparent hover:border-gray-200 dark:hover:bg-[#21262d]">
                    <div class="flex items-center space-x-2 overflow-hidden">
                      <button
                        onClick={() => void toggleDiff(file.path)}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      >
                        <span
                          class={`transform transition-transform inline-block ${expanded()[file.path] ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                      </button>
                      <span class="text-sm text-gray-700 dark:text-gray-300 truncate font-mono" title={file.path}>
                        {file.path}
                      </span>
                      <span class="text-xs text-green-500 w-4">{file.x}</span>
                    </div>
                    <button
                      onClick={() => void handleUnstage(file.path)}
                      class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover:opacity-100"
                    >
                      -
                    </button>
                  </div>
                  <Show when={expanded()[file.path]}>
                    <div class="mt-1 p-2 bg-gray-50 dark:bg-[#0d1117] rounded text-xs font-mono overflow-x-auto text-gray-600 dark:text-gray-400 whitespace-pre">
                      <DiffContent diff={diffs()[file.path] || ''} />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">Changes</h3>
            <div class="flex items-center space-x-2">
              <span class="text-xs text-gray-500">{unstagedFiles().length}</span>
              <button
                onClick={() => void handleStageAll()}
                class="text-gray-500 hover:text-gray-700 dark:hover:text-white"
                title="Stage All Changes"
              >
                +
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <For each={unstagedFiles()}>
              {(file) => (
                <div class="group">
                  <div class="flex items-center justify-between p-2 bg-white dark:bg-[#161b22] rounded border border-transparent hover:border-gray-200 dark:hover:bg-[#21262d]">
                    <div class="flex items-center space-x-2 overflow-hidden">
                      <button
                        onClick={() => void toggleDiff(file.path)}
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      >
                        <span
                          class={`transform transition-transform inline-block ${expanded()[file.path] ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                      </button>
                      <span class="text-sm text-gray-700 dark:text-gray-300 truncate font-mono" title={file.path}>
                        {file.path}
                      </span>
                      <span class={`text-xs w-4 ${file.y === '?' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {file.y === '?' ? 'U' : file.y}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleStage(file.path)}
                      class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white opacity-0 group-hover:opacity-100"
                    >
                      +
                    </button>
                  </div>
                  <Show when={expanded()[file.path]}>
                    <div class="mt-1 p-2 bg-gray-50 dark:bg-[#0d1117] rounded text-xs font-mono overflow-x-auto text-gray-600 dark:text-gray-400 whitespace-pre">
                      <DiffContent diff={diffs()[file.path] || ''} />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}

function DiffContent(props: { diff: string }) {
  return (
    <div class="font-mono text-xs overflow-x-auto whitespace-pre">
      <Show when={props.diff} fallback="Loading...">
        <For each={props.diff.split('\n')}>
          {(line) => {
            let color = 'text-gray-600 dark:text-gray-400'
            let bg = ''
            if (
              line.startsWith('--- ') ||
              line.startsWith('+++ ') ||
              line.startsWith('diff ') ||
              line.startsWith('index ')
            ) {
              color = 'text-gray-500 dark:text-gray-500 font-bold'
            } else if (line.startsWith('+')) {
              color = 'text-green-600 dark:text-green-400'
              bg = 'bg-green-50 dark:bg-green-900/30'
            } else if (line.startsWith('-')) {
              color = 'text-red-600 dark:text-red-400'
              bg = 'bg-red-50 dark:bg-red-900/30'
            } else if (line.startsWith('@@')) {
              color = 'text-blue-600 dark:text-blue-400'
            }
            return <div class={`${color} ${bg} px-1 w-full block`}>{line}</div>
          }}
        </For>
      </Show>
    </div>
  )
}
