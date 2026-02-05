import { createResource, For } from 'solid-js'
import { getRecentWorkspaces } from '../../api/workspaces'

export default function RecentProjects(props: { onOpen: (path: string) => void }) {
  const [workspaces] = createResource(getRecentWorkspaces)

  return (
    <div class="flex flex-col gap-2">
      <h2 class="text-xl font-bold">Recent Projects</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={workspaces()}>
          {(ws) => (
            <div
              onClick={() => props.onOpen(ws.path)}
              class="cursor-pointer rounded-lg border border-gray-200 p-4 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div class="truncate font-bold">{ws.name}</div>
              <div class="mb-2 truncate text-xs text-gray-500" title={ws.path}>
                {ws.path}
              </div>
              <div class="flex flex-wrap gap-1">
                <For each={ws.tags || []}>
                  {(tag) => (
                    <span class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {tag}
                    </span>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
        {workspaces.state === 'ready' && workspaces().length === 0 && (
          <div class="p-4 text-gray-500 italic">No recent projects found.</div>
        )}
      </div>
    </div>
  )
}
