import { createEffect, createSignal, For, onMount, Show } from 'solid-js'
import { findRepos } from '../api/git'
import RepoControl from './RepoControl'

interface Props {
  folder: string
}

export default function DiffView(props: Props) {
  const [repos, setRepos] = createSignal<string[]>([])
  const [loading, setLoading] = createSignal(true)

  const scanRepos = async () => {
    setLoading(true)
    try {
      const found = await findRepos(props.folder)
      // Sort so that shorter paths (closer to root) come first
      found.sort((a, b) => a.length - b.length)
      setRepos(found)
    } catch (e) {
      console.error(e)
      setRepos([props.folder])
    } finally {
      setLoading(false)
    }
  }

  onMount(() => {
    void scanRepos()
  })

  // Re-scan if folder changes? usually top level component mounts once.
  createEffect(() => {
    // If props.folder changes, re-run
    if (props.folder) {
      void scanRepos()
    }
  })

  return (
    <div class="flex h-full flex-col border-r border-gray-200 bg-white dark:border-[#30363d] dark:bg-[#010409]">
      <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4 dark:border-[#30363d] dark:bg-[#010409]">
        <h2 class="font-bold text-gray-700 dark:text-gray-200">Source Control</h2>
        <button
          onClick={() => void scanRepos()}
          title="Rescan Repositories"
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            ></path>
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={!loading()}
          fallback={<div class="p-4 text-center text-sm text-gray-500">Scanning for repositories...</div>}
        >
          <Show
            when={repos().length > 0}
            fallback={<div class="p-4 text-center text-sm text-gray-500">No repositories found.</div>}
          >
            <For each={repos()}>{(repoPath) => <RepoControl repoPath={repoPath} rootDir={props.folder} />}</For>
          </Show>
        </Show>
      </div>
    </div>
  )
}
