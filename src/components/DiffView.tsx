import { createEffect, createSignal, For } from 'solid-js'

interface FileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'untracked'
}

interface Props {
  folder: string
}

export default function DiffView(props: Props) {
  const [files, setFiles] = createSignal<FileStatus[]>([])
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [diffs, setDiffs] = createSignal<Record<string, string | null>>({})
  const [summary, setSummary] = createSignal<{ filesChanged: number; added: number; removed: number } | null>(null)

  createEffect(() => {
    fetch(`/files/status?folder=${encodeURIComponent(props.folder)}`)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const arr = data as Array<string | FileStatus>
          const mapped = arr.map((f) => (typeof f === 'string' ? { path: f, status: 'modified' as const } : f))
          setFiles(mapped)
        }
      })
      .catch(console.error)
    // also fetch diff summary
    fetch(`/files/diff-summary?folder=${encodeURIComponent(props.folder)}`)
      .then((res) => res.json())
      .then((s: unknown) => {
        if (s && typeof s === 'object') {
          const st = s as Record<string, unknown>
          setSummary({
            filesChanged: Number(st.filesChanged ?? 0),
            added: Number(st.added ?? 0),
            removed: Number(st.removed ?? 0)
          })
        }
      })
      .catch(() => setSummary(null))
  })

  const toggleExpand = async (path: string) => {
    const isOpen = expanded()[path]
    const next = { ...expanded() }
    next[path] = !isOpen
    setExpanded(next)
    if (!isOpen && !diffs()[path]) {
      // fetch diff or file content depending on status
      const file = files().find((f) => f.path === path)
      try {
        if (file && file.status === 'added') {
          // new file: fetch full contents
          const res = await fetch(
            `/files/read?folder=${encodeURIComponent(props.folder)}&path=${encodeURIComponent(path)}`
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
          // convert to pseudo-diff with all lines as additions
          const lines = content.split(/\r?\n/)
          const pseudo = ['*** New File: ' + path, '*** Begin', ...lines.map((l) => '+' + l), '*** End'].join('\n')
          setDiffs({ ...diffs(), [path]: pseudo })
        } else {
          const res = await fetch(
            `/files/diff?folder=${encodeURIComponent(props.folder)}&path=${encodeURIComponent(path)}`
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

  // Parse unified diff text into structured lines with gutter numbers
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
        // parse hunk header: @@ -a,b +c,d @@
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
      // context or other
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

  return (
    <div class="h-full flex flex-col bg-white dark:bg-[#0d1117] transition-colors duration-200">
      <div class="p-4 border-b border-gray-200 dark:border-[#30363d] font-semibold bg-[#f6f8fa] dark:bg-[#010409] text-gray-900 dark:text-gray-100">
        <div class="flex items-center justify-between">
          <div class="font-semibold">Changes</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {summary() ? (
              <span>
                {summary()!.filesChanged} files •{' '}
                <span class="text-green-600 dark:text-green-400">+{summary()!.added}</span>{' '}
                <span class="text-red-600 dark:text-red-400">-{summary()!.removed}</span>
              </span>
            ) : (
              ''
            )}
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <For each={files()}>
          {(file) => (
            <div class="border-b border-gray-200 dark:border-[#30363d]">
              <div class="p-1 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#161b22] transition-colors">
                <div class="flex items-center gap-3">
                  <span
                    class={`mr-1 font-bold w-4 text-center ${
                      file.status === 'modified'
                        ? 'text-yellow-600 dark:text-yellow-500'
                        : file.status === 'added'
                          ? 'text-green-600 dark:text-green-500'
                          : file.status === 'deleted'
                            ? 'text-red-600 dark:text-red-500'
                            : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {file.status === 'modified' && 'M'}
                    {file.status === 'added' && 'A'}
                    {file.status === 'deleted' && 'D'}
                    {file.status === 'untracked' && '?'}
                  </span>
                  <span class="font-mono text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60vw]">
                    {file.path}
                  </span>
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
                      // Render parsed diff with colored lines and gutter
                      (() => {
                        const parsed = parseUnified(diffs()[file.path] || '')
                        return (
                          <div>
                            {parsed.map((ln) => (
                              <div
                                class={`flex gap-2 w-full items-stretch ${ln.type === 'meta' ? 'text-gray-500' : ''}`}
                              >
                                <div class="w-auto text-right text-xs text-gray-400 select-none">
                                  {ln.oldLine ?? ln.newLine ?? ''}
                                </div>
                                {/* <div class="w-2 text-right text-xs text-gray-400 select-none">{ln.newLine ?? ''}</div> */}
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
        {files().length === 0 && (
          <div class="p-8 text-center text-gray-500 dark:text-gray-400">No changes detected</div>
        )}
      </div>
    </div>
  )
}
