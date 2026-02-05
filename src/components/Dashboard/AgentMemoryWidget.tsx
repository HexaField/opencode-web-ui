import { createResource } from 'solid-js'
import { getAgentMemory } from '../../api/agents'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default function AgentMemoryWidget() {
  const [memory] = createResource(getAgentMemory)

  return (
    <div class="flex h-full flex-col gap-4 rounded-lg border border-gray-200 p-6 shadow-sm dark:border-gray-700">
      <h2 class="text-xl font-bold">Memory & Lessons</h2>
      <div class="flex-1 overflow-auto text-sm text-gray-600 dark:text-gray-300">
        {memory.loading ? (
             <p>Loading memory...</p>
        ) : memory()?.lessons ? (
             <div 
                class="prose prose-sm dark:prose-invert"
                innerHTML={DOMPurify.sanitize(marked.parse(memory()?.lessons || '') as string)}
             />
        ) : (
            <p class="italic text-gray-400">No lessons learned yet.</p>
        )}
      </div>
    </div>
  )
}
