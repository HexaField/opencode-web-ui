import { createSignal } from 'solid-js'
import RecentProjects from './RecentProjects'
import NewProjectWizard from './NewProjectWizard'
import FolderBrowser from '../FolderBrowser'
import GlobalChatWidget from './GlobalChatWidget'
import AgentStatusHeader from './AgentStatusHeader'
import AgentMemoryWidget from './AgentMemoryWidget'

export default function DashboardView(props: { onOpen: (path: string) => void }) {
  const [mode, setMode] = createSignal<'recent' | 'browse'>('recent')

  return (
    <div class="h-full w-full overflow-auto bg-gray-50 p-8 text-gray-900 dark:bg-[#0d1117] dark:text-gray-100">
      <div class="mx-auto max-w-6xl space-y-8">
        <header class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold">Personal Agent Dashboard</h1>
            <p class="text-gray-500 dark:text-gray-400">Manage your workspaces and projects.</p>
          </div>
          <AgentStatusHeader />
        </header>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column: Projects */}
            <div class="lg:col-span-2 space-y-8">
                <section>
                    <RecentProjects onOpen={props.onOpen} />
                </section>

                <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <section>
                        <NewProjectWizard onCreated={props.onOpen} />
                    </section>
                    <section class="flex h-full flex-col gap-4 rounded-lg border border-gray-200 p-6 shadow-sm dark:border-gray-700">
                        <h2 class="text-xl font-bold">Open Existing</h2>
                        <p class="text-sm text-gray-500">Browse your local file system.</p>

                        {mode() !== 'browse' ? (
                        <button
                            onClick={() => setMode('browse')}
                            class="w-full rounded bg-gray-200 p-2 transition hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                            Browse Filesystem
                        </button>
                        ) : (
                        <div class="min-h-[300px] flex-1 overflow-hidden rounded border">
                            <FolderBrowser onSelectFolder={props.onOpen} />
                        </div>
                        )}
                        {mode() === 'browse' && (
                        <button onClick={() => setMode('recent')} class="self-start text-sm text-blue-500 hover:underline">
                            Cancel
                        </button>
                        )}
                    </section>
                </div>
            </div>

            {/* Right Column: Agent Context */}
            <div class="space-y-8 flex flex-col">
                 <GlobalChatWidget />
                 <div class="flex-1 min-h-[300px]">
                    <AgentMemoryWidget />
                 </div>
            </div>
        </div>
      </div>
    </div>
  )
}
