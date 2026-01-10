import { createEffect, createSignal, For, Show } from 'solid-js'
import { deleteFile, writeFile } from '../api/files'
import { checkout, createBranch } from '../api/git'
import { createSession, promptSession } from '../api/sessions'
import { updateTask } from '../api/tasks'
import ChatInterface from './ChatInterface'
import CodeEditor from './CodeEditor'
import DiffView from './DiffView'
import FileTree from './FileTree'
import PlanView from './Plan/PlanView'
import SessionList from './SessionList'
import SettingsModal from './SettingsModal'
import Terminal from './Terminal'

interface Props {
  folder: string
  onBack: () => void
}

export default function DesktopWorkspace(props: Props) {
  const params = new URLSearchParams(window.location.search)
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(params.get('session'))

  // Left sidebar state
  const [leftTab, setLeftTab] = createSignal<'files' | 'changes' | 'plan' | 'terminal'>('files')
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true)
  const [sidebarWidth, setSidebarWidth] = createSignal(260)

  // Chat/Right sidebar state
  const [chatWidth, setChatWidth] = createSignal(350)
  const [isChatOpen, setIsChatOpen] = createSignal(true)

  // Editor state
  const [panes, setPanes] = createSignal<string[]>([])
  const [activePaneIndex, setActivePaneIndex] = createSignal(0)

  // Initialize from URL param 'file' for the first pane
  const initialFile = params.get('file')
  if (initialFile && panes().length === 0) {
    setPanes([initialFile])
  }

  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

  // For file creation/deletion in FileTree
  const [isCreatingFile, setIsCreatingFile] = createSignal(false)
  const [newFileName, setNewFileName] = createSignal('')
  const [lastUpdated, setLastUpdated] = createSignal(Date.now())
  const [fileToDelete, setFileToDelete] = createSignal<string | null>(null)

  createEffect(() => {
    const sid = currentSessionId()
    const url = new URL(window.location.href)

    if (sid) {
      url.searchParams.set('session', sid)
    } else {
      url.searchParams.delete('session')
    }

    // We update 'file' param to be the active pane's file
    const activeFile = panes()[activePaneIndex()]
    if (activeFile) {
      url.searchParams.set('file', activeFile)
    } else {
      url.searchParams.delete('file')
    }

    window.history.replaceState({}, '', url)
  })

  createEffect(() => {
    const handleOpenFile = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; folder: string }>
      if (customEvent.detail && customEvent.detail.folder === props.folder) {
        openFile(customEvent.detail.path)
      }
    }

    window.addEventListener('open-file', handleOpenFile)
    document.addEventListener('open-file', handleOpenFile)
    return () => {
      window.removeEventListener('open-file', handleOpenFile)
      document.removeEventListener('open-file', handleOpenFile)
    }
  })

  const handleStartSession = async (sessionTitle: string, agentId: string, prompt: string, taskId?: string) => {
    if (taskId) {
      await updateTask(props.folder, taskId, { status: 'in-progress' })
      const branchName = `issue/${taskId}`
      try {
        await createBranch(props.folder, branchName)
      } catch (e) {
        console.error('Failed to create branch', e)
      }
      await checkout(props.folder, branchName)
    }

    const session = await createSession(props.folder, { title: sessionTitle, agent: agentId })
    setCurrentSessionId(session.id)
    setIsChatOpen(true)

    if (prompt.trim()) {
      void promptSession(props.folder, session.id, { parts: [{ type: 'text', text: prompt }] })
    }
  }

  const openFile = (path: string, paneIndex: number = -1) => {
    const currentPanes = [...panes()]

    // If paneIndex is -1, use active pane or create one if none
    if (paneIndex === -1) {
      if (currentPanes.length === 0) {
        setPanes([path])
        setActivePaneIndex(0)
      } else {
        // Replace content of active pane
        currentPanes[activePaneIndex()] = path
        setPanes(currentPanes)
      }
    } else {
      // Open in specific pane
      if (paneIndex >= currentPanes.length) {
        // Add new pane if within limit
        if (currentPanes.length < 3) {
          setPanes([...currentPanes, path])
          setActivePaneIndex(currentPanes.length)
        }
      } else {
        currentPanes[paneIndex] = path
        setPanes(currentPanes)
        setActivePaneIndex(paneIndex)
      }
    }
  }

  const closePane = (index: number) => {
    const currentPanes = [...panes()]
    currentPanes.splice(index, 1)
    setPanes(currentPanes)
    if (activePaneIndex() >= currentPanes.length) {
      setActivePaneIndex(Math.max(0, currentPanes.length - 1))
    }
  }

  const splitPane = (path: string, index: number, direction: 'left' | 'right') => {
    const currentPanes = [...panes()]
    if (currentPanes.length >= 3) return

    if (direction === 'right') {
      currentPanes.splice(index + 1, 0, path)
      setPanes(currentPanes)
      setActivePaneIndex(index + 1)
    } else {
      currentPanes.splice(index, 0, path)
      setPanes(currentPanes)
      setActivePaneIndex(index)
    }
  }

  // Resizing logic
  const startResizeLeft = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth()

    const onMove = (e: MouseEvent) => {
      setSidebarWidth(Math.max(200, Math.min(600, startWidth + (e.clientX - startX))))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResizeChat = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = chatWidth()

    const onMove = (e: MouseEvent) => {
      setChatWidth(Math.max(300, Math.min(800, startWidth - (e.clientX - startX))))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // File operations
  const createFile = async () => {
    if (!newFileName().trim()) return
    const folder = props.folder.endsWith('/') ? props.folder.slice(0, -1) : props.folder
    const path = folder + '/' + newFileName().trim()
    try {
      await writeFile(path, '')
      setLastUpdated(Date.now())
      setIsCreatingFile(false)
      setNewFileName('')
      openFile(path)
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
      // Close panes showing this file
      const newPanes = panes().filter((p) => p !== path)
      setPanes(newPanes)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-white text-gray-900 transition-colors duration-200 dark:bg-[#0d1117] dark:text-gray-100">
      <SettingsModal isOpen={isSettingsOpen()} onClose={() => setIsSettingsOpen(false)} onChangeFolder={props.onBack} />

      {/* Modals */}
      <Show when={fileToDelete()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="w-96 rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-[#30363d] dark:bg-[#161b22]">
            <h3 class="mb-2 text-lg font-semibold">Delete File</h3>
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
            <h3 class="mb-2 text-lg font-semibold">New File</h3>
            <input
              class="mb-4 w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-[#30363d] dark:bg-[#0d1117]"
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

      {/* LEFT SIDEBAR */}
      <div
        class={`relative flex flex-col overflow-hidden border-r border-gray-200 bg-[#f6f8fa] transition-all duration-0 dark:border-[#30363d] dark:bg-[#010409] ${!isSidebarOpen() ? "w-0 border-r-0" : ''}`}
        style={{ width: isSidebarOpen() ? `${sidebarWidth()}px` : '0px' }}
      >
        {/* Sidebar Tabs */}
        <div class="flex shrink-0 items-center gap-1 border-b border-gray-200 p-1 dark:border-[#30363d]">
          <button
            class={`flex-1 rounded-sm px-3 py-1 text-sm ${leftTab() === 'files' ? "bg-white font-medium shadow-sm dark:bg-[#161b22]" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
            onClick={() => setLeftTab('files')}
          >
            Files
          </button>
          <button
            class={`flex-1 rounded-sm px-3 py-1 text-sm ${leftTab() === 'changes' ? "bg-white font-medium shadow-sm dark:bg-[#161b22]" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
            onClick={() => setLeftTab('changes')}
          >
            Changes
          </button>
          <button
            class={`flex-1 rounded-sm px-3 py-1 text-sm ${leftTab() === 'plan' ? "bg-white font-medium shadow-sm dark:bg-[#161b22]" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
            onClick={() => setLeftTab('plan')}
          >
            Plan
          </button>
          <button
            class={`flex-1 rounded-sm px-3 py-1 text-sm ${leftTab() === 'terminal' ? "bg-white font-medium shadow-sm dark:bg-[#161b22]" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
            onClick={() => setLeftTab('terminal')}
          >
            Terminal
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            class="rounded-sm px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-[#21262d] dark:hover:text-gray-200"
            title="Hide Sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div class="relative flex-1 overflow-hidden">
          <div class="flex h-full flex-col" style={{ display: leftTab() === 'files' ? 'flex' : 'none' }}>
            <div class="flex h-full flex-col">
              <div class="flex items-center justify-between p-2 text-xs font-semibold text-gray-500 uppercase">
                <span>Explorer</span>
                <div class="flex gap-1">
                  <button onClick={() => setIsCreatingFile(true)} class="p-1 hover:text-blue-600" title="New File">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="flex-1 overflow-hidden">
                <FileTree
                  rootPath={props.folder}
                  onSelectFile={(path) => openFile(path, -1)}
                  selectedPath={panes()[activePaneIndex()]}
                  lastUpdated={lastUpdated()}
                />
              </div>
              {/* Settings Button at bottom of files tab */}
              <div class="border-t border-gray-200 p-2 dark:border-[#30363d]">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  class="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-[#21262d]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Settings
                </button>
              </div>
            </div>
          </div>
          <div class="flex h-full flex-col" style={{ display: leftTab() === 'changes' ? 'flex' : 'none' }}>
            <DiffView folder={props.folder} />
          </div>
          <div class="flex h-full flex-col" style={{ display: leftTab() === 'plan' ? 'flex' : 'none' }}>
            <PlanView onStartSession={handleStartSession} />
          </div>
          <div class="flex h-full flex-col" style={{ display: leftTab() === 'terminal' ? 'flex' : 'none' }}>
            <Terminal active={leftTab() === 'terminal'} folder={props.folder} />
          </div>
        </div>

        {/* Resize Handle */}
        <div
          class="absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:bg-blue-500 hover:opacity-100"
          onMouseDown={startResizeLeft}
        ></div>
      </div>

      {/* Toggle Sidebar Button (when closed) */}
      <Show when={!isSidebarOpen()}>
        <div class="flex h-full w-8 shrink-0 flex-col items-center gap-4 border-r border-gray-200 bg-[#f6f8fa] py-4 dark:border-[#30363d] dark:bg-[#010409]">
          <button onClick={() => setIsSidebarOpen(true)} class="rounded p-1 hover:bg-gray-200 dark:hover:bg-[#21262d]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-gray-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </Show>

      {/* MAIN CONTENT AREA (Editors) */}
      <div class="relative flex flex-1 overflow-hidden bg-white dark:bg-[#0d1117]">
        <Show
          when={panes().length > 0}
          fallback={
            <div class="flex flex-1 items-center justify-center text-gray-400">
              <div class="text-center">
                <p class="mb-2">No files open</p>
                <p class="text-sm">Select a file from the sidebar to start editing</p>
              </div>
            </div>
          }
        >
          <For each={panes()}>
            {(path, index) => (
              <div
                class="relative h-full flex-1 overflow-hidden border-r border-gray-200 last:border-r-0 dark:border-[#30363d]"
                onClick={() => setActivePaneIndex(index())}
              >
                {/* Drag overlay for splitting */}
                <div
                  class="pointer-events-none absolute inset-0 z-20 hidden"
                  classList={{ hidden: false }} // Always active for drop detection logic in solid-js usually needs state
                >
                  {/* We implement drag and drop zones manually here or on the container */}
                  <div
                    class="absolute top-0 bottom-0 left-0 z-30 w-8 bg-blue-500/20 opacity-0 transition-opacity"
                    ondragenter={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.opacity = '1'
                    }}
                    ondragleave={(e) => {
                      e.currentTarget.style.opacity = '0'
                    }}
                    ondragover={(e) => e.preventDefault()}
                    ondrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.opacity = '0'
                      const filePath = e.dataTransfer?.getData('application/opencode-file')
                      if (filePath) {
                        splitPane(filePath, index(), 'left')
                      }
                    }}
                  ></div>
                  <div
                    class="absolute top-0 right-0 bottom-0 z-30 w-8 bg-blue-500/20 opacity-0 transition-opacity"
                    ondragenter={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.opacity = '1'
                    }}
                    ondragleave={(e) => {
                      e.currentTarget.style.opacity = '0'
                    }}
                    ondragover={(e) => e.preventDefault()}
                    ondrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.style.opacity = '0'
                      const filePath = e.dataTransfer?.getData('application/opencode-file')
                      if (filePath) {
                        splitPane(filePath, index(), 'right')
                      }
                    }}
                  ></div>
                </div>

                <CodeEditor
                  filePath={path}
                  folder={props.folder}
                  onClose={() => closePane(index())}
                  onFocus={() => setActivePaneIndex(index())}
                />
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* RIGHT SIDEBAR (Chat) */}
      <div
        class={`relative flex flex-col overflow-hidden border-l border-gray-200 bg-white transition-all duration-0 dark:border-[#30363d] dark:bg-[#0d1117] ${!isChatOpen() ? "w-0 border-l-0" : ''}`}
        style={{ width: isChatOpen() ? `${chatWidth()}px` : '0px' }}
      >
        {/* Chat Header */}
        <div class="flex items-center justify-between border-b border-gray-200 bg-[#f6f8fa] p-2 dark:border-[#30363d] dark:bg-[#010409]">
          <div class="flex items-center gap-2">
            <button
              onClick={() => setIsChatOpen(false)}
              class="rounded-sm p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-[#21262d] dark:hover:text-gray-200"
              title="Hide Chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div class="text-sm font-medium">Chat</div>
          </div>

          {/* Session Dropdown/Selector */}
          <div class="group relative mx-2 flex-1">
            <Show when={currentSessionId()}>
              <div class="cursor-pointer truncate rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-[#30363d] dark:bg-[#161b22]">
                Session: {currentSessionId()?.slice(0, 8)}...
              </div>
            </Show>
          </div>

          <div class="flex gap-1">
            <button
              onClick={() => setCurrentSessionId(null)}
              class="rounded p-1 hover:bg-gray-200 dark:hover:bg-[#21262d]"
              title="Sessions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setIsChatOpen(false)}
              class="hidden rounded p-1 hover:bg-gray-200 dark:hover:bg-[#21262d]"
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
        </div>

        {/* Chat Content or Session List */}
        <div class="relative flex-1 overflow-hidden">
          <Show
            when={currentSessionId()}
            fallback={
              <SessionList
                folder={props.folder}
                currentSessionId={currentSessionId()}
                onSelectSession={setCurrentSessionId}
              />
            }
          >
            <ChatInterface folder={props.folder} sessionId={currentSessionId()!} />

            {/* Back to list overlay button if needed, or just rely on the header button */}
          </Show>
        </div>

        {/* Resize Handle */}
        <div
          class="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:bg-blue-500 hover:opacity-100"
          onMouseDown={startResizeChat}
        ></div>
      </div>

      {/* Toggle Chat Button (when closed) */}
      <Show when={!isChatOpen()}>
        <div class="absolute right-4 bottom-4 z-50">
          <button
            onClick={() => setIsChatOpen(true)}
            class="rounded-full bg-blue-600 p-3 text-white shadow-lg transition-transform hover:scale-105 hover:bg-blue-700"
            title="Open Chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
        </div>
      </Show>
    </div>
  )
}
