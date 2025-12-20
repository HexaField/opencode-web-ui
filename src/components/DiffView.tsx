import { createEffect, createSignal, For, Show } from 'solid-js'

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

  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [diffs, setDiffs] = createSignal<Record<string, string | null>>({})

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/git/status?folder=${encodeURIComponent(props.folder)}`)
      const data = (await res.json()) as GitFileStatus[]
      if (Array.isArray(data)) setGitFiles(data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await fetch(`/api/git/branches?folder=${encodeURIComponent(props.folder)}`)
      const data = (await res.json()) as string[]
      if (Array.isArray(data)) setBranches(data)

      const res2 = await fetch(`/api/git/current-branch?folder=${encodeURIComponent(props.folder)}`)
      const data2 = (await res2.json()) as { branch?: string }
      if (data2.branch) setCurrentBranch(data2.branch)
    } catch (e) {
      console.error(e)
    }
  }

  createEffect(() => {
    void fetchStatus()
    void fetchBranches()
  })

  const stagedFiles = () => gitFiles().filter((f) => f.x !== ' ' && f.x !== '?')
  const unstagedFiles = () => gitFiles().filter((f) => f.y !== ' ')

  const handleStage = async (path: string) => {
    await fetch('/api/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, files: [path] })
    })
    void fetchStatus()
  }

  const handleUnstage = async (path: string) => {
    await fetch('/api/git/unstage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, files: [path] })
    })
    void fetchStatus()
  }

  const handleCommit = async () => {
    if (!commitMessage()) return
    await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, message: commitMessage() })
    })
    setCommitMessage('')
    void fetchStatus()
  }

  const handleGenerateMessage = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/git/generate-commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: props.folder })
      })
      const data = (await res.json()) as { message?: string }
      if (data.message) setCommitMessage(data.message)
    } catch (e) {
      console.error(e)
    }
    setIsGenerating(false)
  }

  const handlePush = async () => {
    await fetch('/api/git/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, remote: 'origin', branch: currentBranch() })
    })
  }

  const handlePull = async () => {
    await fetch('/api/git/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, remote: 'origin', branch: currentBranch() })
    })
    void fetchStatus()
  }

  const handleCheckout = async (e: Event) => {
    const branch = (e.target as HTMLSelectElement).value
    setCurrentBranch(branch)
    await fetch('/api/git/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: props.folder, branch })
    })
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
          const res = await fetch(
            `/api/files/read?folder=${encodeURIComponent(props.folder)}&path=${encodeURIComponent(path)}`
          )
          const body: unknown = await res.json()
          let content = ''
          if (body && typeof body === 'object' && 'content' in (body as Record<string, unknown>)) {
            const c = (body as Record<string, unknown>).content
            if (typeof c === 'string') content = c
            else content = JSON.stringify(c ?? '', null, 2)
          } else if (typeof body === 'string') {
            content = body
          } else {
            content = JSON.stringify(body ?? '', null, 2)
          }
          const lines = content.split(/\r?\n/)
          const pseudo = ['*** New File: ' + path, '*** Begin', ...lines.map((l) => '+' + l), '*** End'].join('\n')
          setDiffs({ ...diffs(), [path]: pseudo })
        } else {
          const res = await fetch(
            `/api/files/diff?folder=${encodeURIComponent(props.folder)}&path=${encodeURIComponent(path)}`
          )
          const body: unknown = await res.json()
          let diffText = ''
          if (body && typeof body === 'object') {
            const b = body as Record<string, unknown>
            if (typeof b.diff === 'string') diffText = b.diff
            else if (typeof b.error === 'string') diffText = `Error: ${b.error}`
            else diffText = JSON.stringify(b)
          } else {
            if (body === null || body === undefined) diffText = ''
            else if (typeof body === 'string') diffText = body
            else diffText = JSON.stringify(body, null, 2)
          }
          setDiffs({ ...diffs(), [path]: diffText })
        }
      } catch (err) {
        setDiffs({ ...diffs(), [path]: `Error loading diff: ${String(err)}` })
      }
    }
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
          <div class="p-1 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={props.staged}
                onChange={() => void (props.staged ? handleUnstage(file.path) : handleStage(file.path))}
                class="ml-2"
              />
              <span
                class={`mr-1 font-bold w-4 text-center ${
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
              <span class="font-mono text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60vw]">{file.path}</span>
            </div>
            <div>
              <button
                class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded"
                onClick={() => void toggleExpand(file.path)}
              >
                {expanded()[file.path] ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>
          {expanded()[file.path] && (
            <div class="p-1 bg-white dark:bg-[#0d1117]">
              <div class="overflow-x-auto text-sm font-mono leading-relaxed text-[13px]">
                {diffs()[file.path] ? (
                  (() => {
                    const parsed = parseUnified(diffs()[file.path] || '')
                    return (
                      <div>
                        {parsed.map((ln) => (
                          <div class={`flex gap-2 w-full items-stretch ${ln.type === 'meta' ? 'text-gray-500' : ''}`}>
                            <div class="w-auto text-right text-xs text-gray-400 select-none">
                              {ln.oldLine ?? ln.newLine ?? ''}
                            </div>
                            <div
                              class={`px-2 py-0.5 flex-1 whitespace-pre-wrap w-full text-left ${ln.type === 'add' ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ln.type === 'del' ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-transparent text-gray-800 dark:text-gray-200'}`}
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
                Pull
              </button>
              <button
                onClick={() => void handlePush()}
                class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                Push
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

      <div class="flex-1 overflow-y-auto">
        <div class="p-2">
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
            <button
              onClick={() => void handleGenerateMessage()}
              disabled={isGenerating()}
              class="bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isGenerating() ? '...' : '✨'}
            </button>
          </div>
        </div>

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
  )
}
