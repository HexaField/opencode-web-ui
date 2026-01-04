import { createEffect, createSignal, For, Show } from 'solid-js'
import { getFileDiff, readFile } from '../api/files'
import {
  checkout,
  commit,
  generateCommitMessage,
  getAheadBehind,
  getCurrentBranch,
  getGitStatus,
  listBranches,
  merge,
  pull,
  push,
  stageFiles,
  unstageFiles
} from '../api/git'
import { updateTask } from '../api/tasks'

interface GitFileStatus {
  path: string
  x: string
  y: string
}

interface Props {
  folder: string
}

export default function DiffView(props: Props) {
  const [gitFiles, setGitFiles] = createSignal<GitFileStatus[]>([])
  const [branches, setBranches] = createSignal<string[]>([])
  const [currentBranch, setCurrentBranch] = createSignal('')
  const [commitMessage, setCommitMessage] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [aheadBehind, setAheadBehind] = createSignal<{ ahead: number; behind: number }>({ ahead: 0, behind: 0 })

  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [diffs, setDiffs] = createSignal<Record<string, string | null>>({})

  const fetchStatus = async () => {
    try {
      const data = await getGitStatus(props.folder)
      if (Array.isArray(data)) setGitFiles(data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchBranches = async () => {
    try {
      const data = await listBranches(props.folder)
      if (Array.isArray(data)) setBranches(data)

      const data2 = await getCurrentBranch(props.folder)
      if (data2.branch) setCurrentBranch(data2.branch)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchAheadBehind = async () => {
    try {
      const res = await getAheadBehind(props.folder, 'origin', currentBranch())
      if (res && typeof res.ahead === 'number' && typeof res.behind === 'number') {
        setAheadBehind({ ahead: res.ahead, behind: res.behind })
      }
    } catch (err) {
      // ignore errors
      console.error('Failed to fetch ahead/behind', err)
    }
  }

  createEffect(() => {
    void fetchStatus()
    void fetchBranches()
  })

  createEffect(() => {
    const branch = currentBranch()
    if (branch) {
      void fetchAheadBehind()
    }
  })

  const stagedFiles = () => gitFiles().filter((f) => f.x !== ' ' && f.x !== '?')
  const unstagedFiles = () => gitFiles().filter((f) => f.y !== ' ')

  const handleStage = async (path: string) => {
    await stageFiles(props.folder, [path])
    void fetchStatus()
  }

  const handleUnstage = async (path: string) => {
    await unstageFiles(props.folder, [path])
    void fetchStatus()
  }

  const handleCommit = async () => {
    if (!commitMessage()) return
    await commit(props.folder, commitMessage())
    setCommitMessage('')
    void fetchStatus()
  }

  const handleGenerateMessage = async () => {
    setIsGenerating(true)
    try {
      const data = await generateCommitMessage(props.folder)
      if (data.message) setCommitMessage(data.message)
    } catch (e) {
      console.error(e)
    }
    setIsGenerating(false)
  }

  const handlePush = async () => {
    await push(props.folder, 'origin', currentBranch())
    void fetchAheadBehind()
  }

  const handlePull = async () => {
    await pull(props.folder, 'origin', currentBranch())
    void fetchStatus()
    void fetchAheadBehind()
  }

  const handleStageAll = async () => {
    await stageFiles(props.folder, ['.'])
    void fetchStatus()
  }

  const handleUnstageAll = async () => {
    await unstageFiles(props.folder, ['.'])
    void fetchStatus()
  }

  const handleAccept = async () => {
    // 1. Check for pending changes
    const hasChanges = gitFiles().length > 0
    if (hasChanges) {
      // Stage all
      await stageFiles(props.folder, ['.'])

      // Generate message if empty
      let msg = commitMessage()
      if (!msg) {
        const data = await generateCommitMessage(props.folder)
        if (data.message) msg = data.message
      }

      // Commit
      if (msg) {
        await commit(props.folder, msg)
      }
    }

    // 2. Merge to default branch
    const defaultBranch = branches().includes('main') ? 'main' : 'master'
    const branchToMerge = currentBranch()
    // Update task status if it's an issue branch
    if (branchToMerge.startsWith('issue/')) {
      const taskId = branchToMerge.replace('issue/', '')
      try {
        await updateTask(props.folder, taskId, { status: 'done' })
      } catch (e) {
        console.error('Failed to update task status', e)
      }
    }
    // Checkout default branch
    await checkout(props.folder, defaultBranch)

    // Merge the issue branch
    await merge(props.folder, branchToMerge)

    // Refresh
    void fetchStatus()
    void fetchBranches()
  }

  const handleCheckout = async (e: Event) => {
    const branch = (e.target as HTMLSelectElement).value
    setCurrentBranch(branch)
    await checkout(props.folder, branch)
    void fetchStatus()
  }

  const toggleExpand = async (path: string) => {
    const isOpen = expanded()[path]
    const next = { ...expanded() }
    next[path] = !isOpen
    setExpanded(next)
    if (!isOpen && !diffs()[path]) {
      // fetch diff
      try {
        // Check if it's a new file (untracked or added)
        const file = gitFiles().find((f) => f.path === path)
        const isNew = file && (file.x === 'A' || (file.x === '?' && file.y === '?'))

        if (isNew) {
          const { content } = await readFile(props.folder, path)
          const lines = content.split(/\r?\n/)
          const pseudo = ['*** New File: ' + path, '*** Begin', ...lines.map((l) => '+' + l), '*** End'].join('\n')
          setDiffs({ ...diffs(), [path]: pseudo })
        } else {
          const { diff } = await getFileDiff(props.folder, path)
          setDiffs({ ...diffs(), [path]: diff })
        }
      } catch (err) {
        setDiffs({ ...diffs(), [path]: `Error loading diff: ${String(err)}` })
      }
    }
  }

  const openInEditor = (path: string) => {
    // Dispatch custom event to open file in editor
    window.dispatchEvent(
      new CustomEvent('open-file', {
        detail: {
          path: path,
          folder: props.folder
        }
      })
    )
  }

  function parseUnified(diffText: string) {
    const out: Array<{
      type: 'meta' | 'context' | 'add' | 'del'
      oldLine: number | null
      newLine: number | null
      text: string
    }> = []
    const lines = diffText.split(/\r?\n/)
    let oldLine = 0
    let newLine = 0
    for (const line of lines) {
      if (line.startsWith('@@')) {
        const m = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
        if (m) {
          oldLine = Number(m[1])
          newLine = Number(m[3])
          out.push({ type: 'meta', oldLine: null, newLine: null, text: line })
          continue
        }
      }
      if (line.startsWith('+')) {
        out.push({ type: 'add', oldLine: null, newLine, text: line.slice(1) })
        newLine++
        continue
      }
      if (line.startsWith('-')) {
        out.push({ type: 'del', oldLine, newLine: null, text: line.slice(1) })
        oldLine++
        continue
      }
      if (line.startsWith('*** New File:')) {
        out.push({ type: 'meta', oldLine: null, newLine: null, text: line })
        continue
      }
      if (line.startsWith('*** Begin') || line.startsWith('*** End')) {
        out.push({ type: 'meta', oldLine: null, newLine: null, text: line })
        continue
      }
      out.push({
        type: 'context',
        oldLine: oldLine || null,
        newLine: newLine || null,
        text: line.startsWith(' ') ? line.slice(1) : line
      })
      if (oldLine) oldLine++
      if (newLine) newLine++
    }
    return out
  }

  const FileList = (props: { files: GitFileStatus[]; staged: boolean }) => (
    <For each={props.files}>
      {(file) => (
        <div class="border-b border-gray-200 dark:border-[#30363d]">
          <div class="p-1 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors min-w-0">
            <div class="flex items-center gap-3 max-w-full min-w-0">
              <input
                type="checkbox"
                checked={props.staged}
                onChange={() => void (props.staged ? handleUnstage(file.path) : handleStage(file.path))}
                class="ml-2 flex-shrink-0"
              />
              <span
                class={`mr-1 font-bold w-4 text-center flex-shrink-0 ${
                  (props.staged ? file.x : file.y) === 'M'
                    ? 'text-yellow-600 dark:text-yellow-500'
                    : (props.staged ? file.x : file.y) === 'A' || (file.x === '?' && file.y === '?')
                      ? 'text-green-600 dark:text-green-500'
                      : (props.staged ? file.x : file.y) === 'D'
                        ? 'text-red-600 dark:text-red-500'
                        : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {(props.staged ? file.x : file.y) === 'M' && 'M'}
                {(props.staged ? file.x : file.y) === 'A' && 'A'}
                {(props.staged ? file.x : file.y) === 'D' && 'D'}
                {file.x === '?' && file.y === '?' && '?'}
              </span>
              <span class="font-mono text-[14px] text-gray-700 dark:text-gray-300 truncate min-w-0">{file.path}</span>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button
                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded"
                onClick={() => openInEditor(file.path)}
                title="Open in Editor"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded"
                onClick={() => void toggleExpand(file.path)}
                title={expanded()[file.path] ? 'Collapse' : 'Expand'}
              >
                <span
                  class="transform transition-transform duration-150 inline-block"
                  classList={{ 'rotate-90': expanded()[file.path] }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6 4l8 6-8 6V4z" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
          {expanded()[file.path] && (
            <div class="p-1 bg-white dark:bg-[#0d1117]">
              <div class="overflow-x-hidden text-sm font-mono leading-relaxed text-[13px] max-w-full">
                {diffs()[file.path] ? (
                  (() => {
                    const parsed = parseUnified(diffs()[file.path] || '')
                    return (
                      <div class="min-w-0">
                        {parsed.map((ln) => (
                          <div class={`flex gap-2 w-full items-stretch ${ln.type === 'meta' ? 'text-gray-500' : ''}`}>
                            <div class="w-auto text-right text-xs text-gray-400 select-none">
                              {ln.oldLine ?? ln.newLine ?? ''}
                            </div>
                            <div
                              class={`px-2 py-0.5 flex-1 whitespace-pre-wrap w-full max-w-full text-left ${ln.type === 'add' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ln.type === 'del' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-transparent text-gray-800 dark:text-gray-200'}`}
                            >
                              <span class="font-mono text-[13px] block w-full text-left">
                                {ln.type === 'add' ? '+' : ln.type === 'del' ? '-' : ' '}
                                {ln.text}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()
                ) : (
                  <pre class="whitespace-pre-wrap">Loading...</pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </For>
  )

  return (
    <div class="h-full flex flex-col bg-white dark:bg-[#0d1117] transition-colors duration-200">
      <div class="p-4 border-b border-gray-200 dark:border-[#30363d] font-semibold bg-[#f6f8fa] dark:bg-[#010409] text-gray-900 dark:text-gray-100">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="font-semibold">Source Control</div>
            <div class="flex gap-2">
              <button
                onClick={() => void handlePull()}
                class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                {aheadBehind().behind > 0 ? `Pull (${aheadBehind().behind})` : 'Pull'}
              </button>
              <button
                onClick={() => void handlePush()}
                class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                {aheadBehind().ahead > 0 ? `Push (${aheadBehind().ahead})` : 'Push'}
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <select
              value={currentBranch()}
              onChange={(e) => void handleCheckout(e)}
              class="text-sm p-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 w-full"
            >
              <For each={branches()}>{(b) => <option value={b}>{b}</option>}</For>
            </select>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col min-h-0">
        <div class="p-2 flex-none">
          <textarea
            class="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-sm"
            rows={3}
            placeholder="Message (Cmd+Enter to commit)"
            value={commitMessage()}
            onInput={(e) => setCommitMessage(e.currentTarget.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                void handleCommit()
              }
            }}
          />
          <div class="flex gap-2 mt-2">
            <button
              onClick={() => void handleCommit()}
              disabled={!commitMessage()}
              class="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Commit
            </button>
            <Show when={currentBranch().startsWith('issue/')}>
              <button
                onClick={() => void handleAccept()}
                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Accept
              </button>
            </Show>
            <button
              onClick={() => void handleGenerateMessage()}
              disabled={isGenerating()}
              class="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isGenerating() ? '...' : '✨'}
            </button>
          </div>

          <div class="flex gap-2 mt-2">
            <button
              onClick={() => void handleStageAll()}
              class="text-sm bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 flex-shrink-0"
            >
              Stage All
            </button>
            <button
              onClick={() => void handleUnstageAll()}
              class="text-sm bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 flex-shrink-0"
            >
              Unstage All
            </button>
          </div>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style="scrollbar-gutter: stable;">
          <div class="p-2">
            <Show when={stagedFiles().length > 0}>
              <div class="px-2 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">Staged Changes</div>
              <FileList files={stagedFiles()} staged={true} />
            </Show>

            <Show when={unstagedFiles().length > 0}>
              <div class="px-2 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">Changes</div>
              <FileList files={unstagedFiles()} staged={false} />
            </Show>

            {gitFiles().length === 0 && (
              <div class="p-8 text-center text-gray-500 dark:text-gray-400">No changes detected</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
