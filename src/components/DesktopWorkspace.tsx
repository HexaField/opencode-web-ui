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

interface Props {
  folder: string
  onBack: () => void
}

export default function DesktopWorkspace(props: Props) {
  const params = new URLSearchParams(window.location.search)
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(params.get('session'))

  // Left sidebar state
  const [leftTab, setLeftTab] = createSignal<'files' | 'changes' | 'plan'>('files')
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
    <div class="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <SettingsModal isOpen={isSettingsOpen()} onClose={() => setIsSettingsOpen(false)} onChangeFolder={props.onBack} />

      {/* Modals */}
      <Show when={fileToDelete()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-white dark:bg-[#161b22] p-4 rounded-lg shadow-xl border border-gray-200 dark:border-[#30363d] w-96">
            <h3 class="text-lg font-semibold mb-2">Delete File</h3>
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
                onClick={() => void deleteFileHandler()}
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
            <h3 class="text-lg font-semibold mb-2">New File</h3>
            <input
              class="w-full border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] rounded px-2 py-1 mb-4"
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

      {/* LEFT SIDEBAR */}
      <div
        class={`flex flex-col border-r border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] transition-all duration-0 overflow-hidden relative ${!isSidebarOpen() ? 'w-0 border-r-0' : ''}`}
        style={{ width: isSidebarOpen() ? `${sidebarWidth()}px` : '0px' }}
      >
        {/* Sidebar Tabs */}
        <div class="flex items-center p-1 border-b border-gray-200 dark:border-[#30363d] gap-1 shrink-0">
          <button
            class={`px-3 py-1 text-sm rounded-sm flex-1 ${leftTab() === 'files' ? 'bg-white dark:bg-[#161b22] shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            onClick={() => setLeftTab('files')}
          >
            Files
          </button>
          <button
            class={`px-3 py-1 text-sm rounded-sm flex-1 ${leftTab() === 'changes' ? 'bg-white dark:bg-[#161b22] shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            onClick={() => setLeftTab('changes')}
          >
            Changes
          </button>
          <button
            class={`px-3 py-1 text-sm rounded-sm flex-1 ${leftTab() === 'plan' ? 'bg-white dark:bg-[#161b22] shadow-sm font-medium' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
            onClick={() => setLeftTab('plan')}
          >
            Plan
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            class="px-2 py-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-sm hover:bg-gray-200 dark:hover:bg-[#21262d]"
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
        <div class="flex-1 overflow-hidden relative">
          <Show when={leftTab() === 'files'}>
            <div class="h-full flex flex-col">
              <div class="flex items-center justify-between p-2 text-xs font-semibold text-gray-500 uppercase">
                <span>Explorer</span>
                <div class="flex gap-1">
                  <button onClick={() => setIsCreatingFile(true)} class="hover:text-blue-600 p-1" title="New File">
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
              <div class="p-2 border-t border-gray-200 dark:border-[#30363d]">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  class="flex items-center gap-2 w-full px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded"
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
          </Show>
          <Show when={leftTab() === 'changes'}>
            <DiffView folder={props.folder} />
          </Show>
          <Show when={leftTab() === 'plan'}>
            <PlanView onStartSession={handleStartSession} />
          </Show>
        </div>

        {/* Resize Handle */}
        <div
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 z-10 opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={startResizeLeft}
        ></div>
      </div>

      {/* Toggle Sidebar Button (when closed) */}
      <Show when={!isSidebarOpen()}>
        <div class="h-full w-8 border-r border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] flex flex-col items-center py-4 gap-4 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} class="p-1 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded">
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
      <div class="flex-1 flex overflow-hidden bg-white dark:bg-[#0d1117] relative">
        <Show
          when={panes().length > 0}
          fallback={
            <div class="flex-1 flex items-center justify-center text-gray-400">
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
                class="flex-1 h-full overflow-hidden relative border-r border-gray-200 dark:border-[#30363d] last:border-r-0"
                onClick={() => setActivePaneIndex(index())}
              >
                {/* Drag overlay for splitting */}
                <div
                  class="absolute inset-0 z-20 hidden pointer-events-none"
                  classList={{ hidden: false }} // Always active for drop detection logic in solid-js usually needs state
                >
                  {/* We implement drag and drop zones manually here or on the container */}
                  <div
                    class="absolute left-0 top-0 bottom-0 w-8 bg-blue-500/20 opacity-0 transition-opacity z-30"
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
                    class="absolute right-0 top-0 bottom-0 w-8 bg-blue-500/20 opacity-0 transition-opacity z-30"
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
        class={`flex flex-col border-l border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] transition-all duration-0 overflow-hidden relative ${!isChatOpen() ? 'w-0 border-l-0' : ''}`}
        style={{ width: isChatOpen() ? `${chatWidth()}px` : '0px' }}
      >
        {/* Chat Header */}
        <div class="flex items-center justify-between p-2 border-b border-gray-200 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409]">
          <div class="flex items-center gap-2">
            <button
              onClick={() => setIsChatOpen(false)}
              class="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-sm hover:bg-gray-200 dark:hover:bg-[#21262d]"
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
            <div class="font-medium text-sm">Chat</div>
          </div>

          {/* Session Dropdown/Selector */}
          <div class="flex-1 mx-2 relative group">
            <Show when={currentSessionId()}>
              <div class="text-xs truncate bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 cursor-pointer">
                Session: {currentSessionId()?.slice(0, 8)}...
              </div>
            </Show>
          </div>

          <div class="flex gap-1">
            <button
              onClick={() => setCurrentSessionId(null)}
              class="p-1 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded"
              title="Sessions"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setIsChatOpen(false)}
              class="p-1 hover:bg-gray-200 dark:hover:bg-[#21262d] rounded hidden"
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
        <div class="flex-1 overflow-hidden relative">
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
          class="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500 z-10 opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={startResizeChat}
        ></div>
      </div>

      {/* Toggle Chat Button (when closed) */}
      <Show when={!isChatOpen()}>
        <div class="absolute right-4 bottom-4 z-50">
          <button
            onClick={() => setIsChatOpen(true)}
            class="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105"
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
