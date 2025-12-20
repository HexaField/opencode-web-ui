import { createEffect, createSignal, For } from 'solid-js'

interface Entry {
  name: string
  isDirectory: boolean
  path: string
}

interface Props {
  onSelectFolder: (path: string) => void
}

export default function FolderBrowser(props: Props) {
  const [currentPath, setCurrentPath] = createSignal('')
  const [inputPath, setInputPath] = createSignal('')
  const [entries, setEntries] = createSignal<Entry[]>([])
  const [ignoreDotFiles, setIgnoreDotFiles] = createSignal(true)

  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const path = currentPath()
    // Sync input with current path when it changes externally (e.g. clicking folder)
    setInputPath(path)
    setError(null)

    const url = path ? `/api/fs/list?path=${encodeURIComponent(path)}` : '/api/fs/list'
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        const serverPath = res.headers.get('x-current-path')
        if (serverPath && !path) {
          setCurrentPath(serverPath)
        }
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setEntries(data)
        }
      })
      .catch((err) => {
        console.error(err)
        setError(String(err))
      })
  })

  const handleEntryClick = (entry: Entry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path)
    }
  }

  const handleUp = () => {
    const p = currentPath()
    if (p && p !== '/') {
      const parent = p.split('/').slice(0, -1).join('/') || '/'
      setCurrentPath(parent)
    }
  }

  const handleGo = () => {
    setCurrentPath(inputPath())
  }

  return (
    <div class="p-4 bg-white dark:bg-[#0d1117] rounded-xl shadow-sm border border-gray-200 dark:border-[#30363d] transition-colors duration-200">
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <button
              onClick={handleUp}
              class="px-2 py-1 bg-gray-100 dark:bg-[#21262d] text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-[#30363d] transition-colors"
              disabled={!currentPath()}
            >
              ⬆️
            </button>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Select Folder</h2>
          </div>
          <button
            class="bg-[#2da44e] hover:bg-[#2c974b] text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
            onClick={() => props.onSelectFolder(currentPath())}
          >
            Select this folder
          </button>
        </div>
        <div class="flex gap-2">
          <input
            class="flex-1 border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#010409] text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={inputPath()}
            onInput={(e) => setInputPath(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder="Enter path..."
          />
          <button
            class="bg-gray-100 dark:bg-[#21262d] text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-[#30363d] transition-colors border border-gray-200 dark:border-[#30363d]"
            onClick={handleGo}
          >
            Go
          </button>
          <button
            class={`px-3 py-1.5 rounded-md text-sm transition-colors border ${
              ignoreDotFiles()
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-gray-100 dark:bg-[#21262d] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-[#30363d]'
            }`}
            onClick={() => setIgnoreDotFiles(!ignoreDotFiles())}
            title="Toggle ignoring dot files"
          >
            {ignoreDotFiles() ? 'Hidden' : 'Shown'}
          </button>
        </div>
      </div>
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 font-mono px-1">Current: {currentPath() || 'Root'}</div>
      {error() && <div class="text-red-500 dark:text-red-400 text-sm mb-2 px-1">Error: {error()}</div>}
      <div class="border border-gray-200 dark:border-[#30363d] rounded-md h-96 overflow-y-auto bg-white dark:bg-[#0d1117]">
        <For each={entries().filter((e) => !ignoreDotFiles() || !e.name.startsWith('.'))}>
          {(entry) => (
            <div
              class="cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-[#161b22] flex items-center border-b border-gray-100 dark:border-[#21262d] last:border-b-0 text-gray-700 dark:text-gray-300 transition-colors"
              onClick={() => handleEntryClick(entry)}
            >
              <span class="mr-2">{entry.isDirectory ? '📁' : '📄'}</span>
              {entry.name}
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
