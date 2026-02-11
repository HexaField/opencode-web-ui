import { createEffect, createSignal } from 'solid-js'
import DesktopWorkspace from './components/DesktopWorkspace'
import DashboardView from './components/Dashboard/DashboardView'
import Workspace from './components/Workspace'
import ChatPage from './components/ChatPage'
import { ThemeProvider } from './theme'

function App() {
  const params = new URLSearchParams(window.location.search)
  const [folder, setFolder] = createSignal<string | null>(params.get('folder'))
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768)
  const isChat = window.location.pathname === '/chat'

  createEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  createEffect(() => {
    const f = folder()
    const url = new URL(window.location.href)
    if (f) {
      url.searchParams.set('folder', f)
    } else {
      url.searchParams.delete('folder')
      url.searchParams.delete('session')
    }
    window.history.replaceState({}, '', url)
  })

  return (
    <ThemeProvider>
      <div class="h-screen w-screen bg-white font-sans text-gray-900 transition-colors duration-200 dark:bg-[#0d1117] dark:text-gray-100">
        {isChat ? (
          <ChatPage />
        ) : folder() ? (
          isMobile() ? (
            <Workspace folder={folder()!} onBack={() => setFolder(null)} />
          ) : (
            <DesktopWorkspace folder={folder()!} onBack={() => setFolder(null)} />
          )
        ) : (
          <DashboardView onOpen={setFolder} />
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
