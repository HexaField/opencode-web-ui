import { For } from 'solid-js'

export interface ProjectCardProps {
    name: string
    path: string
    tags?: string[]
    onOpen: (path: string) => void
}

export default function ProjectCard(props: ProjectCardProps) {
  return (
    <div
      onClick={() => props.onOpen(props.path)}
      class="cursor-pointer rounded-lg border border-gray-200 p-4 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      <div class="truncate font-bold">{props.name}</div>
      <div class="mb-2 truncate text-xs text-gray-500" title={props.path}>
        {props.path}
      </div>
      <div class="flex flex-wrap gap-1">
        <For each={props.tags || []}>
          {(tag) => (
            <span class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {tag}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}
