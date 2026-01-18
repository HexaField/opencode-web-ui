import * as monaco from 'monaco-editor'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { deleteFile, readFSFile, writeFile } from '../api/files'
import { useTheme } from '../theme'
import FileTree from './FileTree'
import SearchPanel from './SearchPanel'

// Configure Monaco workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

interface Props {
  folder: string
  selectedFile: string | null
  onSelectFile: (path: string | null) => void
}

export default function FilesView(props: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(localStorage.getItem('opencode_sidebar_open') !== 'false')
  const [isDirty, setIsDirty] = createSignal(false)
  const [isPaletteOpen, setIsPaletteOpen] = createSignal(true)
  const [editor, setEditor] = createSignal<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const [isCreatingFile, setIsCreatingFile] = createSignal(false)
  const [newFileName, setNewFileName] = createSignal('')
  const [lastUpdated, setLastUpdated] = createSignal(Date.now())
  const [fileToDelete, setFileToDelete] = createSignal<string | null>(null)
  const [activeTab, setActiveTab] = createSignal<'files' | 'search'>('files')
  const [targetPosition, setTargetPosition] = createSignal<{ path: string; line: number; character: number } | null>(
    null
  )

  let editorContainer: HTMLDivElement | undefined
  let cleanupListeners: (() => void) | undefined
  const { isDark } = useTheme()

  createEffect(() => {
    localStorage.setItem('opencode_sidebar_open', String(isSidebarOpen()))
  })

  // Update theme
  createEffect(() => {
    monaco.editor.setTheme(isDark() ? 'vs-dark' : 'vs')
  })

  // Load file content
  createEffect(() => {
    const file = props.selectedFile
    const _ = lastUpdated()
    const ed = editor()
    if (file && ed) {
      readFSFile(file)
        .then((data) => {
          if (data.content !== undefined) {
            const uri = monaco.Uri.file(file)
            let model = monaco.editor.getModel(uri)
            if (!model) {
              model = monaco.editor.createModel(
                data.content,
                undefined, // auto-detect language
                uri
              )
            } else {
              if (model.getValue() !== data.content) {
                model.setValue(data.content)
              }
            }
            ed.setModel(model)
            setIsDirty(false)

            const target = targetPosition()
            if (target && target.path === file) {
              ed.revealPositionInCenter({ lineNumber: target.line, column: target.character + 1 })
              ed.setPosition({ lineNumber: target.line, column: target.character + 1 })
              ed.focus()
              setTargetPosition(null)
            }
          }
        })
        .catch(console.error)
    }
  })

  onMount(() => {
    if (editorContainer) {
      const ed = monaco.editor.create(editorContainer, {
        value: '',
        theme: isDark() ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        padding: { top: 16 }
      })

      ed.onDidChangeModelContent(() => {
        if (!isDirty()) setIsDirty(true)
      })

      // Add keybinding for save
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void saveFile()
      })

      setEditor(ed)

      // Fix for keyboard popping up on drag (scrolling)
      let isDragging = false
      let startX = 0
      let startY = 0

      const onDown = (e: MouseEvent | TouchEvent) => {
        isDragging = false
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
        startX = clientX
        startY = clientY
      }

      const onMove = (e: MouseEvent | TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
        if (!isDragging && (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5)) {
          isDragging = true
          const selection = ed.getSelection()
          if (selection && selection.isEmpty()) {
            if (document.activeElement?.tagName === 'TEXTAREA') {
              ;(document.activeElement as HTMLElement).blur()
            }
          }
        }
      }

      const onUp = () => {
        if (isDragging) {
          const selection = ed.getSelection()
          if (selection && selection.isEmpty()) {
            setTimeout(() => {
              if (document.activeElement?.tagName === 'TEXTAREA') {
                ;(document.activeElement as HTMLElement).blur()
              }
            }, 10)
          }
        }
        isDragging = false
      }

      editorContainer.addEventListener('mousedown', onDown)
      editorContainer.addEventListener('touchstart', onDown)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('touchmove', onMove)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('touchend', onUp)

      cleanupListeners = () => {
        editorContainer.removeEventListener('mousedown', onDown)
        editorContainer.removeEventListener('touchstart', onDown)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('mouseup', onUp)
        window.removeEventListener('touchend', onUp)
      }
    }
  })

  onCleanup(() => {
    cleanupListeners?.()
    editor()?.dispose()
    monaco.editor.getModels().forEach((model) => model.dispose())
  })

  const saveFile = async () => {
    const file = props.selectedFile
    const ed = editor()
    if (!file || !ed) return

    const content = ed.getValue()
    try {
      await writeFile(file, content)
      setIsDirty(false)
    } catch (e) {
      console.error(e)
    }
  }

  const navigateToMatch = (path: string, line: number, character: number) => {
    if (props.selectedFile === path) {
      const ed = editor()
      if (ed) {
        ed.revealPositionInCenter({ lineNumber: line, column: character + 1 })
        ed.setPosition({ lineNumber: line, column: character + 1 })
        ed.focus()
      }
    } else {
      setTargetPosition({ path, line, character })
      props.onSelectFile(path)
    }
  }

  const undo = () => {
    editor()?.trigger('keyboard', 'undo', null)
  }

  const redo = () => {
    editor()?.trigger('keyboard', 'redo', null)
  }

  const createFile = async () => {
    if (!newFileName().trim()) return
    // Ensure we don't double slash if folder ends with /
    const folder = props.folder.endsWith('/') ? props.folder.slice(0, -1) : props.folder
    const path = folder + '/' + newFileName().trim()
    try {
      await writeFile(path, '')
      setLastUpdated(Date.now())
      setIsCreatingFile(false)
      setNewFileName('')
      props.onSelectFile(path)
    } catch (e) {
      console.error(e)
    }
  }

  const deleteFileHandler = async () => {
    const path = fileToDelete()
    if (!path) return
    try {
      await deleteFile(path)
      setLastUpdated(Date.now())
      setFileToDelete(null)
      if (props.selectedFile === path) {
        props.onSelectFile(null)
        editor()?.setValue('')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div class="relative flex h-full w-full">
      <Show when={fileToDelete()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]">
            <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete File</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span class="font-mono text-sm">{fileToDelete()?.split('/').pop()}</span>?
            </p>
            <div class="flex justify-end gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                class="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteFileHandler()}
                class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={isCreatingFile()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]">
            <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">New File</h3>
            <input
              class="mb-4 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-100"
              placeholder="filename.ext"
              value={newFileName()}
              onInput={(e) => setNewFileName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createFile()
                if (e.key === 'Escape') setIsCreatingFile(false)
              }}
              autofocus
            />
            <div class="flex justify-end gap-2">
              <button
                onClick={() => setIsCreatingFile(false)}
                class="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
              >
                Cancel
              </button>
              <button
                onClick={() => void createFile()}
                class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </Show>
      <div
        class={`${
          isSidebarOpen() ? 'w-64' : 'w-0'
        } flex shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-[#f6f8fa] transition-all duration-200 dark:border-[#30363d] dark:bg-[#010409]`}
      >
        <div class="flex items-center justify-between border-b border-gray-200 px-2 py-1 text-sm font-medium dark:border-[#30363d]">
          <div class="flex gap-4">
            <button
              onClick={() => setActiveTab('files')}
              class={`border-b-2 py-1 ${
                activeTab() === 'files'
                  ? "border-blue-500 text-gray-900 dark:text-gray-200"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab('search')}
              class={`border-b-2 py-1 ${
                activeTab() === 'search'
                  ? "border-blue-500 text-gray-900 dark:text-gray-200"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Search
            </button>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            class="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-[#21262d] dark:hover:text-gray-300"
            title="Hide Sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-hidden">
          <Show
            when={activeTab() === 'files'}
            fallback={
              <SearchPanel
                folder={props.folder}
                onNavigate={navigateToMatch}
                onFileChanged={() => setLastUpdated(Date.now())}
              />
            }
          >
            <div class="flex items-center justify-between border-b border-gray-100 p-2 dark:border-[#21262d]">
              <span class="text-xs font-semibold text-gray-500">EXPLORER</span>
              <button
                onClick={() => setIsCreatingFile(true)}
                class="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-blue-600 dark:hover:bg-[#21262d] dark:hover:text-blue-400"
                title="New File"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <FileTree
              rootPath={props.folder}
              onSelectFile={props.onSelectFile}
              selectedPath={props.selectedFile}
              lastUpdated={lastUpdated()}
            />
          </Show>
        </div>
      </div>
      <div class="group relative h-full flex-1 overflow-hidden">
        <div class="h-full w-full" ref={editorContainer}>
          {/* Monaco Editor */}
        </div>

        {/* Floating Palette */}
        <div class="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 transform flex-col items-center gap-2">
          <Show
            when={isPaletteOpen()}
            fallback={
              <button
                onClick={() => setIsPaletteOpen(true)}
                class="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-lg transition-transform hover:scale-110 hover:text-gray-700 dark:border-[#30363d] dark:bg-[#161b22] dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            }
          >
            <div class="animate-in fade-in slide-in-from-bottom-2 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                class={`rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d] ${!isSidebarOpen() ? "bg-gray-100 dark:bg-[#21262d]" : ''}`}
                title={isSidebarOpen() ? 'Collapse File Tree' : 'Expand File Tree'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div class="mx-1 h-4 w-px bg-gray-200 dark:bg-[#30363d]" />

              <button
                onClick={undo}
                class="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
                title="Undo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>

              <button
                onClick={redo}
                class="rounded-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#21262d]"
                title="Redo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                  />
                </svg>
              </button>

              <div class="mx-1 h-4 w-px bg-gray-200 dark:bg-[#30363d]" />

              <button
                onClick={() => props.selectedFile && setFileToDelete(props.selectedFile)}
                class="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-[#21262d] dark:hover:text-red-400"
                title="Delete File"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <button
                onClick={() => void saveFile()}
                class={`flex items-center gap-2 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-[#21262d] ${isDirty() ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}
                title="Save (Cmd+S)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                <Show when={isDirty()}>
                  <span class="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                </Show>
              </button>

              <button
                onClick={() => setIsPaletteOpen(false)}
                class="ml-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
