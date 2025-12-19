import * as monaco from 'monaco-editor'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useTheme } from '../theme'
import FileTree from './FileTree'

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
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(
    localStorage.getItem('opencode_sidebar_open') !== 'false'
  )
  const [isDirty, setIsDirty] = createSignal(false)
  const [isPaletteOpen, setIsPaletteOpen] = createSignal(true)
  const [editor, setEditor] = createSignal<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const [isCreatingFile, setIsCreatingFile] = createSignal(false)
  const [newFileName, setNewFileName] = createSignal('')
  const [lastUpdated, setLastUpdated] = createSignal(Date.now())
  const [fileToDelete, setFileToDelete] = createSignal<string | null>(null)

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
    const ed = editor()
    if (file && ed) {
      fetch(`/fs/read?path=${encodeURIComponent(file)}`)
        .then((res) => res.json())
        .then((data: { content: string }) => {
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
      const res = await fetch('/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file, content })
      })
      if (res.ok) {
        setIsDirty(false)
      }
    } catch (e) {
      console.error(e)
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
      const res = await fetch('/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: '' })
      })
      if (res.ok) {
        setLastUpdated(Date.now())
        setIsCreatingFile(false)
        setNewFileName('')
        props.onSelectFile(path)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const deleteFile = async () => {
    const path = fileToDelete()
    if (!path) return
    try {
      const res = await fetch('/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      })
      if (res.ok) {
        setLastUpdated(Date.now())
        setFileToDelete(null)
        if (props.selectedFile === path) {
          props.onSelectFile(null)
          editor()?.setValue('')
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div class="flex h-full w-full relative">
      <Show when={fileToDelete()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-white dark:bg-[#161b22] p-4 rounded-lg shadow-xl border border-gray-200 dark:border-[#30363d] w-96">
            <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Delete File</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <span class="font-mono text-sm">{fileToDelete()?.split('/').pop()}</span>?
            </p>
            <div class="flex justify-end gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                class="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteFile()}
                class="px-3 py-1 text-sm bg-red-600 text-white hover:bg-red-700 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={isCreatingFile()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-white dark:bg-[#161b22] p-4 rounded-lg shadow-xl border border-gray-200 dark:border-[#30363d] w-80">
            <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">New File</h3>
            <input
              class="w-full border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 rounded px-2 py-1 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                class="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d] rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => void createFile()}
                class="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
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
        } border-r border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] flex flex-col shrink-0 transition-all duration-200 overflow-hidden`}
      >
        <div class="p-2 font-medium text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>Files</span>
            <button
              onClick={() => setIsCreatingFile(true)}
              class="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-200 dark:hover:bg-[#21262d]"
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
          <button
            onClick={() => setIsSidebarOpen(false)}
            class="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#21262d]"
            title="Hide File Tree"
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
          <FileTree
            rootPath={props.folder}
            onSelectFile={props.onSelectFile}
            selectedPath={props.selectedFile}
            lastUpdated={lastUpdated()}
          />
        </div>
      </div>
      <div class="flex-1 h-full overflow-hidden relative group">
        <div class="w-full h-full" ref={editorContainer}>
          {/* Monaco Editor */}
        </div>

        {/* Floating Palette */}
        <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-20">
          <Show
            when={isPaletteOpen()}
            fallback={
              <button
                onClick={() => setIsPaletteOpen(true)}
                class="bg-white dark:bg-[#161b22] p-2 rounded-full shadow-lg border border-gray-200 dark:border-[#30363d] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-transform hover:scale-110"
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
            <div class="flex items-center gap-1 bg-white dark:bg-[#161b22] p-1.5 rounded-lg shadow-xl border border-gray-200 dark:border-[#30363d] animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                class={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-400 ${!isSidebarOpen() ? 'bg-gray-100 dark:bg-[#21262d]' : ''}`}
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

              <div class="w-px h-4 bg-gray-200 dark:bg-[#30363d] mx-1" />

              <button
                onClick={undo}
                class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-400"
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
                class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-400"
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

              <div class="w-px h-4 bg-gray-200 dark:bg-[#30363d] mx-1" />

              <button
                onClick={() => props.selectedFile && setFileToDelete(props.selectedFile)}
                class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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
                class={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#21262d] flex items-center gap-2 ${isDirty() ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
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
                  <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
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
