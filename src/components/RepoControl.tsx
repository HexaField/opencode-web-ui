import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { getFileDiff } from '../api/files'
import {
  checkRadicleStatus,
  commit,
  generateCommitMessage,
  getAheadBehind,
  getCurrentBranch,
  getGitStatus,
  initRadicleRepo,
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
  const [isRadicleRepo, setIsRadicleRepo] = createSignal<boolean | null>(null)
  const [isInitializingRadicle, setIsInitializingRadicle] = createSignal(false)

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

  const fetchRadicleStatus = async () => {
    try {
      const { isRepo } = await checkRadicleStatus(props.repoPath)
      setIsRadicleRepo(isRepo)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInitRadicle = async () => {
    if (!confirm('Initialize Radicle repository here?')) return
    setIsInitializingRadicle(true)
    try {
      await initRadicleRepo(props.repoPath)
      await fetchRadicleStatus()
    } catch (e) {
      alert('Failed to init radicle repo: ' + String(e))
    } finally {
      setIsInitializingRadicle(false)
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
    void fetchRadicleStatus()
  }

  onMount(() => {
    void fetchStatus()
    void fetchBranches()
    void fetchAheadBehind()
    void fetchRadicleStatus()

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
    <div class="flex h-fit flex-col space-y-4 border-b border-gray-200 last:border-b-0 dark:border-[#30363d]">
      <div class="flex items-center justify-between bg-[#f6f8fa] p-2 text-xs font-bold tracking-wider text-gray-700 uppercase dark:bg-[#161b22] dark:text-gray-400">
        <span>{repoName()}</span>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-gray-500">{currentBranch() || '...'}</span>
          <div class="flex space-x-1">
            {aheadBehind().behind > 0 && <span class="text-red-500 dark:text-red-400">↓{aheadBehind().behind}</span>}
            {aheadBehind().ahead > 0 && <span class="text-green-500 dark:text-green-400">↑{aheadBehind().ahead}</span>}
          </div>
          <Show when={isRadicleRepo() === false}>
            <button
              onClick={() => void handleInitRadicle()}
              class="rounded bg-[#ff5555] px-2 py-0.5 text-xs text-white hover:bg-[#ff3333] disabled:opacity-50"
              title="Initialize Radicle Repository"
              disabled={isInitializingRadicle()}
            >
              {isInitializingRadicle() ? '...' : 'Init Radicle'}
            </button>
          </Show>
          <button
            onClick={() => void handlePush()}
            class="rounded p-1 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-[#21262d]"
            title="Push"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          class="min-h-[80px] w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-800 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300"
          placeholder="Message (⌘Enter to commit)"
          value={commitMessage()}
          onInput={(e) => setCommitMessage(e.currentTarget.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              void handleCommit()
            }
          }}
        />
        <div class="mt-2 flex justify-between">
          <button
            onClick={() => void handleGenerateMessage()}
            disabled={isGenerating()}
            class={`flex items-center space-x-1 rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-[#21262d] dark:text-gray-300 dark:hover:bg-[#30363d] ${isGenerating() ? "cursor-not-allowed opacity-50" : ''}`}
          >
            <Show when={isGenerating()} fallback={<span>✨ AI Generate</span>}>
              <span>Generat...</span>
            </Show>
          </button>
          <button
            onClick={() => void handleCommit()}
            disabled={!commitMessage() || stagedFiles().length === 0}
            class="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Commit
          </button>
        </div>
        <Show when={commitError()}>
          <div class="mt-2 max-h-32 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 font-mono text-xs whitespace-pre-wrap text-red-600 dark:border-red-900/30 dark:bg-red-900/10">
            {commitError()}
          </div>
        </Show>
      </div>

      <div class="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <Show when={gitFiles().length === 0}>
          <div class="flex h-32 flex-col items-center justify-center text-gray-500">
            <p>No changes detected</p>
          </div>
        </Show>
        <Show when={gitFiles().length > 0}>
          <div>
            <div class="mb-2 flex items-center justify-between">
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
                    <div class="flex items-center justify-between rounded border border-transparent bg-white p-2 hover:border-gray-200 dark:bg-[#161b22] dark:hover:bg-[#21262d]">
                      <div class="flex items-center space-x-2 overflow-hidden">
                        <button
                          onClick={() => void toggleDiff(file.path)}
                          class="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                        >
                          <span
                            class={`inline-block transform transition-transform ${expanded()[file.path] ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </button>
                        <span class="truncate font-mono text-sm text-gray-700 dark:text-gray-300" title={file.path}>
                          {file.path}
                        </span>
                        <span class="w-4 text-xs text-green-500">{file.x}</span>
                      </div>
                      <button
                        onClick={() => void handleUnstage(file.path)}
                        class="text-xs text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-700 dark:hover:text-white"
                      >
                        -
                      </button>
                    </div>
                    <Show when={expanded()[file.path]}>
                      <div class="mt-1 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs whitespace-pre text-gray-600 dark:bg-[#0d1117] dark:text-gray-400">
                        <DiffContent diff={diffs()[file.path] || ''} />
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
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
                    <div class="flex items-center justify-between rounded border border-transparent bg-white p-2 hover:border-gray-200 dark:bg-[#161b22] dark:hover:bg-[#21262d]">
                      <div class="flex items-center space-x-2 overflow-hidden">
                        <button
                          onClick={() => void toggleDiff(file.path)}
                          class="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                        >
                          <span
                            class={`inline-block transform transition-transform ${expanded()[file.path] ? 'rotate-90' : ''}`}
                          >
                            ▶
                          </span>
                        </button>
                        <span class="truncate font-mono text-sm text-gray-700 dark:text-gray-300" title={file.path}>
                          {file.path}
                        </span>
                        <span class={`w-4 text-xs ${file.y === '?' ? 'text-green-500' : 'text-yellow-500'}`}>
                          {file.y === '?' ? 'U' : file.y}
                        </span>
                      </div>
                      <button
                        onClick={() => void handleStage(file.path)}
                        class="text-xs text-gray-500 opacity-0 group-hover:opacity-100 hover:text-gray-700 dark:hover:text-white"
                      >
                        +
                      </button>
                    </div>
                    <Show when={expanded()[file.path]}>
                      <div class="mt-1 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs whitespace-pre text-gray-600 dark:bg-[#0d1117] dark:text-gray-400">
                        <DiffContent diff={diffs()[file.path] || ''} />
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

function DiffContent(props: { diff: string }) {
  return (
    <div class="overflow-x-auto font-mono text-xs whitespace-pre">
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
            return <div class={`${color} ${bg} block w-full px-1`}>{line}</div>
          }}
        </For>
      </Show>
    </div>
  )
}
