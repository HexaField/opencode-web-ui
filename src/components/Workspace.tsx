import { createEffect, createSignal } from 'solid-js'
import { checkout, createBranch } from '../api/git'
import { createSession, promptSession } from '../api/sessions'
import { updateTask } from '../api/tasks'
import ChatInterface from './ChatInterface'
import DiffView from './DiffView'
import FilesView from './FilesView'
import PlanView from './Plan/PlanView'
import SessionList from './SessionList'
import SettingsModal from './SettingsModal'
import Terminal from './Terminal'

interface Props {
  folder: string
  onBack: () => void
}

export default function Workspace(props: Props) {
  const params = new URLSearchParams(window.location.search)
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(params.get('session'))
  const [view, setView] = createSignal<'chat' | 'changes' | 'files' | 'plan' | 'terminal'>(
    (params.get('view') as 'chat' | 'changes' | 'files' | 'plan' | 'terminal') || 'chat'
  )
  const [selectedFile, setSelectedFile] = createSignal<string | null>(params.get('file'))
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

  createEffect(() => {
    const sid = currentSessionId()
    const v = view()
    console.log('Current View:', v)
    const f = selectedFile()
    const url = new URL(window.location.href)

    if (sid) {
      url.searchParams.set('session', sid)
    } else {
      url.searchParams.delete('session')
    }

    if (v && v !== 'chat') {
      url.searchParams.set('view', v)
    } else {
      url.searchParams.delete('view')
    }

    if (f) {
      url.searchParams.set('file', f)
    } else {
      url.searchParams.delete('file')
    }

    window.history.replaceState({}, '', url)
  })

  createEffect(() => {
    const handleOpenFile = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; folder: string }>
      if (customEvent.detail && customEvent.detail.folder === props.folder) {
        setSelectedFile(customEvent.detail.path)
        setView('files')
      }
    }

    // Also listen for event from same window context if needed
    // But since we are in the same window, just window event is enough.
    // However, if the event is dispatched from an iframe or similar (not here), we might need more.
    // The current setup assumes dispatchEvent on window.

    window.addEventListener('open-file', handleOpenFile)
    document.addEventListener('open-file', handleOpenFile)
    return () => {
      window.removeEventListener('open-file', handleOpenFile)
      document.removeEventListener('open-file', handleOpenFile)
    }
  })

  const handleStartSession = async (sessionTitle: string, agentId: string, prompt: string, taskId?: string) => {
    if (taskId) {
      // Update task status
      await updateTask(props.folder, taskId, { status: 'in-progress' })

      // Create branch
      const branchName = `issue/${taskId}`
      try {
        await createBranch(props.folder, branchName)
      } catch (e) {
        console.error('Failed to create branch', e)
      }

      // Checkout branch
      await checkout(props.folder, branchName)
    }

    // 1. Create session
    const session = await createSession(props.folder, { title: sessionTitle, agent: agentId })

    // 3. Navigate
    setCurrentSessionId(session.id)
    setView('chat')

    // 2. Send prompt
    if (prompt.trim()) {
      void promptSession(props.folder, session.id, { parts: [{ type: 'text', text: prompt }] })
    }
  }

  return (
    <div class="flex fixed inset-0 overflow-hidden bg-white dark:bg-[#0d1117] transition-colors duration-200">
      <SettingsModal isOpen={isSettingsOpen()} onClose={() => setIsSettingsOpen(false)} onChangeFolder={props.onBack} />

      <div class="flex-1 flex flex-col h-full w-full bg-white dark:bg-[#0d1117]">
        <div class="h-14 border-b border-gray-200 dark:border-[#30363d] flex items-center px-4 bg-[#f6f8fa] dark:bg-[#010409] justify-between shrink-0 gap-2">
          <div class="flex items-center gap-3 overflow-hidden">
            {view() === 'chat' && currentSessionId() && (
              <button
                class="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => setCurrentSessionId(null)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div class="flex bg-gray-200 dark:bg-[#21262d] rounded-md p-1">
              <button
                class={`px-3 py-1 rounded-sm text-sm font-medium transition-all ${
                  view() === 'chat'
                    ? 'bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setView('chat')}
              >
                Chat
              </button>
              <button
                class={`px-3 py-1 rounded-sm text-sm font-medium transition-all ${
                  view() === 'changes'
                    ? 'bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setView('changes')}
              >
                Changes
              </button>
              <button
                class={`px-3 py-1 rounded-sm text-sm font-medium transition-all ${
                  view() === 'files'
                    ? 'bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setView('files')}
              >
                Files
              </button>
              <button
                class={`px-3 py-1 rounded-sm text-sm font-medium transition-all ${
                  view() === 'plan'
                    ? 'bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setView('plan')}
              >
                Plan
              </button>
              <button
                class={`px-3 py-1 rounded-sm text-sm font-medium transition-all ${
                  view() === 'terminal'
                    ? 'bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setView('terminal')}
              >
                Terminal
              </button>
            </div>

            <div class="hidden md:block h-4 w-px bg-gray-300 dark:bg-[#30363d] mx-1"></div>
            <div class="hidden md:block font-medium truncate text-gray-600 dark:text-gray-400 text-sm">
              {props.folder}
            </div>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            class="flex p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-[#21262d] transition-colors"
            title="Settings"
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-hidden relative">
          {view() === 'chat' && (
            <div class="flex h-full w-full">
              <div
                class={`
                  border-r border-gray-200 dark:border-[#30363d] shrink-0 flex flex-col
                  ${currentSessionId() ? 'hidden md:flex md:w-64' : 'flex w-full md:w-64'}
                `}
              >
                <SessionList
                  folder={props.folder}
                  currentSessionId={currentSessionId()}
                  onSelectSession={setCurrentSessionId}
                />
              </div>
              <div
                class={`
                  flex-1 h-full overflow-hidden relative
                  ${!currentSessionId() ? 'hidden md:block' : 'block'}
                `}
              >
                {currentSessionId() ? (
                  <ChatInterface folder={props.folder} sessionId={currentSessionId()!} />
                ) : (
                  <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-4">
                    <div class="p-4 bg-gray-50 dark:bg-[#161b22] rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-12 w-12 text-gray-400 dark:text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                    </div>
                    <p>Select or create a session to start</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Keep tabs mounted but toggle visibility */}
          <div class="h-full w-full" style={{ display: view() === 'changes' ? 'block' : 'none' }}>
            <DiffView folder={props.folder} />
          </div>
          <div class="h-full w-full" style={{ display: view() === 'files' ? 'block' : 'none' }}>
            <FilesView folder={props.folder} selectedFile={selectedFile()} onSelectFile={setSelectedFile} />
          </div>
          <div class="h-full w-full" style={{ display: view() === 'plan' ? 'block' : 'none' }}>
            <PlanView onStartSession={handleStartSession} />
          </div>
          <div class="h-full w-full flex flex-col" style={{ display: view() === 'terminal' ? 'flex' : 'none' }}>
            <Terminal active={view() === 'terminal'} folder={props.folder} />
          </div>
        </div>
      </div>
    </div>
  )
}
