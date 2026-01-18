import { createSignal, For, Show, createEffect, onCleanup } from 'solid-js'

interface SearchMatch {
  line: number
  character: number
  matchText: string
  lineText: string
}

interface SearchResult {
  fileName: string
  fullPath: string
  matches: SearchMatch[]
}

interface Props {
  folder: string
  onNavigate: (path: string, line: number, character: number) => void
  onFileChanged?: () => void
}

export default function SearchPanel(props: Props) {
  const [query, setQuery] = createSignal('')
  const [replaceText, setReplaceText] = createSignal('')
  const [include, setInclude] = createSignal('')
  const [exclude, setExclude] = createSignal('')
  const [isRegex, setIsRegex] = createSignal(false)
  const [isCaseSensitive, setIsCaseSensitive] = createSignal(false)
  const [matchWholeWord, setMatchWholeWord] = createSignal(false)
  const [useGitIgnore, setUseGitIgnore] = createSignal(true)

  // Results
  const [results, setResults] = createSignal<SearchResult[]>([])
  const [isSearching, setIsSearching] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  let debounceTimer: number | undefined

  const search = async () => {
    clearTimeout(debounceTimer)
    const activeQuery = query()
    if (!activeQuery) {
      setResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setError(null)
    setResults([])

    try {
      const includeParts = include()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const excludeParts = exclude()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/fs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          folder: props.folder,
          isRegex: isRegex(),
          isCaseSensitive: isCaseSensitive(),
          matchWholeWord: matchWholeWord(),
          useGitIgnore: useGitIgnore(),
          include: includeParts.length ? includeParts : undefined,
          exclude: excludeParts.length ? excludeParts : undefined
        })
      })

      if (query() !== activeQuery) return

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Search failed')
      }

      const data = await res.json()
      setResults(data.results)
    } catch (e: any) {
      if (query() === activeQuery) {
        setError(e.message)
      }
    } finally {
      if (query() === activeQuery) {
        setIsSearching(false)
      }
    }
  }

  createEffect(() => {
    // Track dependencies
    const q = query()
    include()
    exclude()
    isRegex()
    isCaseSensitive()
    matchWholeWord()
    useGitIgnore()

    clearTimeout(debounceTimer)

    if (!q) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    debounceTimer = window.setTimeout(() => {
      search()
    }, 250)
  })

  onCleanup(() => clearTimeout(debounceTimer))

  const replaceOne = async (result: SearchResult, matchIndex: number) => {
    // Replace a specific match
    // logic: read file, replace range, write file.
    // Doing this safely requires knowing the file content hasn't changed.
    // Simplified: Read, verify match is still there, replace, save.
    // For now, simpler: Just load, replace string? No, string might appear multiple times.
    // Use line/col.
    try {
      // Read file first
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(result.fullPath)}`)
      const data = await res.json()
      if (!data.content) throw new Error('Could not read file')

      const lines = data.content.split('\n')
      const match = result.matches[matchIndex]
      const lineIdx = match.line - 1
      const lineContent = lines[lineIdx]

      if (!lineContent) throw new Error('Line not found')

      // Verify match roughly
      // match.character is index.
      // Check if matches.
      // Replace:
      const before = lineContent.substring(0, match.character)
      const after = lineContent.substring(match.character + match.matchText.length)
      const newLine = before + replaceText() + after

      lines[lineIdx] = newLine
      const newContent = lines.join('\n')

      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: result.fullPath, content: newContent })
      })

      // Update results: remove this match or re-search?
      // Re-search is safest but slow.
      // Optimistic update: remove match from UI.
      setResults(
        (prev) =>
          prev
            .map((r) => {
              if (r.fullPath !== result.fullPath) return r
              const newMatches = [...r.matches]
              newMatches.splice(matchIndex, 1)
              if (newMatches.length === 0) return null // remove file if no matches?
              return { ...r, matches: newMatches }
            })
            .filter(Boolean) as SearchResult[]
      )

      if (props.onFileChanged) props.onFileChanged()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const replaceAll = async () => {
    if (!confirm(`Replace all ${results().reduce((acc, r) => acc + r.matches.length, 0)} occurrences?`)) return

    setIsSearching(true)
    try {
      // Group by file
      for (const res of results()) {
        const response = await fetch(`/api/fs/read?path=${encodeURIComponent(res.fullPath)}`)
        const data = await response.json()
        if (!data.content) continue

        let content = data.content as string
        const lines = content.split('\n')

        // Sort matches bottom up by line, then right to left by char
        // But matches are per line.
        // If multiple matches on same line?
        // My backend returns matches array. ordered by line.
        // Assuming backend regex 'g' returns matches in order.

        // We need to be careful.
        // Iterate lines. find matches on that line.
        // Reverse iterate matches to replace.

        const fileMatches = res.matches
        // Group by line
        const matchesByLine: Record<number, SearchMatch[]> = {}
        fileMatches.forEach((m) => {
          if (!matchesByLine[m.line]) matchesByLine[m.line] = []
          matchesByLine[m.line].push(m)
        })

        // For each line with matches
        for (const lineNumStr in matchesByLine) {
          const lineNum = parseInt(lineNumStr)
          const lineIdx = lineNum - 1
          if (lineIdx >= lines.length) continue

          let lineText = lines[lineIdx]
          // Reverse matches on this line so indices stay valid
          const lineMatches = matchesByLine[lineNum].sort((a, b) => b.character - a.character)

          for (const m of lineMatches) {
            // Double check match text
            const _actual = lineText.substring(m.character, m.character + m.matchText.length)
            // If file changed on disk since search, this might be wrong.
            // But for now assume consistent.
            const before = lineText.substring(0, m.character)
            const after = lineText.substring(m.character + m.matchText.length)
            lineText = before + replaceText() + after
          }
          lines[lineIdx] = lineText
        }

        const newContent = lines.join('\n')
        await fetch('/api/fs/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: res.fullPath, content: newContent })
        })
      }
      // Clear results
      setResults([])
      if (props.onFileChanged) props.onFileChanged()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div class="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-[#30363d] dark:bg-[#0d1117]">
      <div class="space-y-2 p-2">
        <div class="space-y-1">
          <div class="flex gap-1" title="Search Query">
            <input
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Search"
              class="w-full rounded border p-1 text-sm dark:border-[#30363d] dark:bg-[#0d1117] dark:text-white"
            />
          </div>
          <div class="flex gap-1">
            <button
              onClick={() => setIsCaseSensitive(!isCaseSensitive())}
              class={`rounded border p-1 text-xs ${isCaseSensitive() ? "border-blue-500 bg-blue-100 dark:bg-blue-900" : 'dark:border-[#30363d]'}`}
              title="Match Case"
            >
              Aa
            </button>
            <button
              onClick={() => setMatchWholeWord(!matchWholeWord())}
              class={`rounded border p-1 text-xs ${matchWholeWord() ? "border-blue-500 bg-blue-100 dark:bg-blue-900" : 'dark:border-[#30363d]'}`}
              title="Match Whole Word"
            >
              \b
            </button>
            <button
              onClick={() => setIsRegex(!isRegex())}
              class={`rounded border p-1 text-xs ${isRegex() ? "border-blue-500 bg-blue-100 dark:bg-blue-900" : 'dark:border-[#30363d]'}`}
              title="Use Regex"
            >
              .*
            </button>
            <button
              onClick={() => setUseGitIgnore(!useGitIgnore())}
              class={`rounded border p-1 text-xs ${useGitIgnore() ? "border-blue-500 bg-blue-100 dark:bg-blue-900" : 'dark:border-[#30363d]'}`}
              title="Use .gitignore"
            >
              .git
            </button>
          </div>
        </div>

        <div class="space-y-1">
          <input
            value={replaceText()}
            onInput={(e) => setReplaceText(e.currentTarget.value)}
            placeholder="Replace"
            class="w-full rounded border p-1 text-sm dark:border-[#30363d] dark:bg-[#0d1117] dark:text-white"
          />
          <div class="flex justify-end gap-1">
            <button
              onClick={replaceAll}
              disabled={results().length === 0}
              class="rounded border bg-white p-1 text-xs hover:bg-gray-100 dark:border-[#30363d] dark:bg-[#21262d]"
            >
              Replace All
            </button>
          </div>
        </div>

        <div class="space-y-1">
          <p class="text-xs font-semibold text-gray-500">files to include</p>
          <input
            value={include()}
            onInput={(e) => setInclude(e.currentTarget.value)}
            placeholder="e.g. *.ts, src/**"
            class="w-full rounded border p-1 text-xs dark:border-[#30363d] dark:bg-[#0d1117] dark:text-white"
          />
        </div>
        <div class="space-y-1">
          <p class="text-xs font-semibold text-gray-500">files to exclude</p>
          <input
            value={exclude()}
            onInput={(e) => setExclude(e.currentTarget.value)}
            placeholder="e.g. *.log, node_modules"
            class="w-full rounded border p-1 text-xs dark:border-[#30363d] dark:bg-[#0d1117] dark:text-white"
          />
        </div>
      </div>

      <Show when={error()}>
        <div class="p-2 text-xs text-red-500">{error()}</div>
      </Show>

      <div class="flex-1 overflow-auto p-2">
        <Show when={isSearching()}>
          <div class="text-center text-xs text-gray-500">Searching...</div>
        </Show>
        <Show when={!isSearching() && results().length === 0 && query()}>
          <div class="text-center text-xs text-gray-500">No results found</div>
        </Show>

        <For each={results()}>
          {(res) => (
            <div class="mb-2">
              <div class="truncate text-xs font-bold text-gray-700 dark:text-gray-300" title={res.fileName}>
                {res.fileName} <span class="text-gray-400">({res.matches.length})</span>
              </div>
              <div class="border-l border-gray-200 pl-2 dark:border-[#30363d]">
                <For each={res.matches}>
                  {(m, idx) => (
                    <div
                      class="group flex cursor-pointer justify-between truncate py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-[#21262d]"
                      onClick={() => props.onNavigate(res.fullPath, m.line, m.character)}
                      title={m.lineText}
                    >
                      <span class="inline-block w-8 pr-1 text-right text-gray-500 dark:text-gray-500">{m.line}:</span>
                      <span class="flex-1 truncate font-mono text-gray-600 dark:text-gray-400">{m.lineText}</span>
                      <button
                        class="rounded bg-gray-200 px-1 text-[10px] opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:bg-[#30363d] dark:hover:bg-blue-900"
                        onClick={(e) => {
                          e.stopPropagation()
                          replaceOne(res, idx())
                        }}
                        title="Replace this match"
                      >
                        R
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
