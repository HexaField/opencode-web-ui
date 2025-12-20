import { createEffect, createSignal, onCleanup } from 'solid-js'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
}

interface Node {
  id: string
  x: number
  y: number
  task: Task
}

export default function DAGView(props: Props) {
  console.log('DAGView rendering')
  let canvasRef: HTMLCanvasElement | undefined
  const [nodes, setNodes] = createSignal<Node[]>([])

  // Simple force-directed layout or layer-based layout
  createEffect(() => {
    console.log('DAGView effect 1')
    const tasks = props.tasks
    console.log('DAGView tasks:', tasks)
    if (!tasks || !tasks.length) {
      console.log('DAGView: no tasks')
      return
    }

    // Initial random positions
    const newNodes: Node[] = tasks.map((t, i) => ({
      id: t.id,
      x: 100 + (i % 5) * 150,
      y: 100 + Math.floor(i / 5) * 100,
      task: t
    }))
    setNodes(newNodes)
  })

  createEffect(() => {
    console.log('DAGView effect 2')
    const canvas = canvasRef
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connections
      ctx.strokeStyle = '#9ca3af'
      ctx.lineWidth = 2

      // Draw nodes
      nodes().forEach((node) => {
        // Draw box
        ctx.fillStyle = '#ffffff'
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          ctx.fillStyle = '#0d1117'
          ctx.strokeStyle = '#30363d'
        }

        ctx.beginPath()
        ctx.roundRect(node.x, node.y, 120, 60, 8)
        ctx.fill()
        ctx.stroke()

        // Draw text
        ctx.fillStyle = '#000000'
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          ctx.fillStyle = '#ffffff'
        }
        ctx.font = '12px sans-serif'
        
        const taskTitle = node.task?.title || 'Untitled'
        const title = taskTitle.length > 15 ? taskTitle.substring(0, 15) + '...' : taskTitle
        ctx.fillText(title, node.x + 10, node.y + 25)

        // Status
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#6b7280'
        ctx.fillText(node.task?.status || 'unknown', node.x + 10, node.y + 45)
      })
    }

    // Handle resize
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800
      canvas.height = canvas.parentElement?.clientHeight || 600
      render()
    }

    window.addEventListener('resize', resize)
    resize()

    onCleanup(() => window.removeEventListener('resize', resize))
  })

  return (
    <div class="w-full h-full overflow-hidden bg-gray-50 dark:bg-[#010409] relative">
      <canvas ref={canvasRef} class="absolute top-0 left-0" />
      <div class="absolute bottom-4 right-4 bg-white dark:bg-[#161b22] p-2 rounded shadow text-xs text-gray-500">
        DAG Visualization (Basic)
      </div>
    </div>
  )
}
