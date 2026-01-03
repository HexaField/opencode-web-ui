import { createEffect, createSignal } from 'solid-js'
import DesktopWorkspace from './components/DesktopWorkspace'
import FolderBrowser from './components/FolderBrowser'
import Workspace from './components/Workspace'
import { ThemeProvider } from './theme'

function App() {
  const params = new URLSearchParams(window.location.search)
  const [folder, setFolder] = createSignal<string | null>(params.get('folder'))
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768)

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
      <div class="h-screen w-screen bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
        {folder() ? (
          isMobile() ? (
            <Workspace folder={folder()!} onBack={() => setFolder(null)} />
          ) : (
            <DesktopWorkspace folder={folder()!} onBack={() => setFolder(null)} />
          )
        ) : (
          <div class="flex items-center justify-center h-full p-4">
            <div class="w-full max-w-2xl">
              <FolderBrowser onSelectFolder={setFolder} />
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
