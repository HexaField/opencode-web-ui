import { createEffect, createSignal, For } from 'solid-js'
import { listFiles, type FileEntry } from '../api/files'

interface Props {
  onSelectFolder: (path: string) => void
}

export default function FolderBrowser(props: Props) {
  const [currentPath, setCurrentPath] = createSignal('')
  const [inputPath, setInputPath] = createSignal('')
  const [entries, setEntries] = createSignal<FileEntry[]>([])
  const [ignoreDotFiles, setIgnoreDotFiles] = createSignal(true)

  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const path = currentPath()
    // Sync input with current path when it changes externally (e.g. clicking folder)
    setInputPath(path)
    setError(null)

    listFiles(path)
      .then(({ files, currentPath: serverPath }) => {
        if (serverPath && !path) {
          setCurrentPath(serverPath)
        }
        if (Array.isArray(files)) {
          setEntries(files)
        }
      })
      .catch((err) => {
        console.error(err)
        setError(String(err))
      })
  })

  const handleEntryClick = (entry: FileEntry) => {
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
    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors duration-200 dark:border-[#30363d] dark:bg-[#0d1117]">
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              onClick={handleUp}
              class="rounded bg-gray-100 px-2 py-1 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-[#21262d] dark:text-gray-200 dark:hover:bg-[#30363d]"
              disabled={!currentPath()}
            >
              ⬆️
            </button>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Select Folder</h2>
          </div>
          <button
            class="rounded-md bg-[#2da44e] px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-[#2c974b]"
            onClick={() => props.onSelectFolder(currentPath())}
          >
            Select this folder
          </button>
        </div>
        <div class="flex gap-2">
          <input
            class="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#010409] dark:text-gray-100"
            value={inputPath()}
            onInput={(e) => setInputPath(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGo()}
            placeholder="Enter path..."
          />
          <button
            class="rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:border-[#30363d] dark:bg-[#21262d] dark:text-gray-200 dark:hover:bg-[#30363d]"
            onClick={handleGo}
          >
            Go
          </button>
          <button
            class={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              ignoreDotFiles()
                ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                : "border-gray-200 bg-gray-100 text-gray-700 dark:border-[#30363d] dark:bg-[#21262d] dark:text-gray-200"
            }`}
            onClick={() => setIgnoreDotFiles(!ignoreDotFiles())}
            title="Toggle ignoring dot files"
          >
            {ignoreDotFiles() ? 'Hidden' : 'Shown'}
          </button>
        </div>
      </div>
      <div class="mb-2 px-1 font-mono text-sm text-gray-500 dark:text-gray-400">Current: {currentPath() || 'Root'}</div>
      {error() && <div class="mb-2 px-1 text-sm text-red-500 dark:text-red-400">Error: {error()}</div>}
      <div class="h-96 overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-[#30363d] dark:bg-[#0d1117]">
        <For each={entries().filter((e) => !ignoreDotFiles() || !e.name.startsWith('.'))}>
          {(entry) => (
            <div
              class="flex cursor-pointer items-center border-b border-gray-100 p-2 text-gray-700 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-[#21262d] dark:text-gray-300 dark:hover:bg-[#161b22]"
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
