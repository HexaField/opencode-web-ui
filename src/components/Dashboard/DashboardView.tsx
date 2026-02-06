import { createSignal, createResource, Show } from 'solid-js'
import RecentProjects from './RecentProjects'
import NewProjectWizard from './NewProjectWizard'
import FolderBrowser from '../FolderBrowser'
import GlobalChatWidget from './GlobalChatWidget'
import AgentStatusHeader from './AgentStatusHeader'
import AgentMemoryWidget from './AgentMemoryWidget'
import { getDashboardData } from '../../api/workspaces'

export default function DashboardView(props: { onOpen: (path: string) => void }) {
  const [mode, setMode] = createSignal<'recent' | 'browse'>('recent')
  const [data] = createResource(getDashboardData)

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
          <div class="space-y-8 lg:col-span-2">
            {/* Personal Home Card */}
            <Show when={data()} fallback={<div class="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800"></div>}>
              {(dashboard) => (
                <section
                  class="flex cursor-pointer items-center justify-between rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-6 shadow-sm transition hover:shadow-md dark:border-purple-900/30 dark:from-purple-900/20 dark:to-[#0d1117]"
                  onClick={() => props.onOpen(dashboard().homePath)}
                >
                  <div>
                    <h2 class="text-xl font-bold text-purple-900 dark:text-purple-300">Personal Home Workspace</h2>
                    <p class="text-sm text-purple-700/80 dark:text-purple-400/80">
                      Manage documents, memories, packs, and agent configuration.
                    </p>
                  </div>
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-purple-600 dark:text-purple-400"
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                </section>
              )}
            </Show>

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
          <div class="flex flex-col space-y-8">
            <GlobalChatWidget />
            <div class="min-h-[300px] flex-1">
              <AgentMemoryWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
