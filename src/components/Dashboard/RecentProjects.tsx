import { createResource, For } from 'solid-js'
import { getRecentWorkspaces } from '../../api/workspaces'
import ProjectCard from './ProjectCard'

export default function RecentProjects(props: { onOpen: (path: string) => void }) {
  const [workspaces] = createResource(getRecentWorkspaces)

  return (
    <div class="flex flex-col gap-2">
      <h2 class="text-xl font-bold">Recent Projects</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={workspaces()}>
          {(ws) => <ProjectCard name={ws.name} path={ws.path} tags={ws.tags} onOpen={props.onOpen} />}
        </For>
        {workspaces.state === 'ready' && workspaces().length === 0 && (
          <div class="p-4 text-gray-500 italic">No recent projects found.</div>
        )}
      </div>
    </div>
  )
}
