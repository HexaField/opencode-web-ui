import { createEffect, createMemo, createSignal, For, onCleanup } from 'solid-js'
import { Task } from '../../types'

interface Props {
  tasks: Task[]
}

interface GraphNode {
  id: string
  task: Task
  children: GraphNode[]
  width: number
  height: number
  x: number // Relative to parent
  y: number // Relative to parent
  globalX: number
  globalY: number
}

interface Edge {
  source: string
  target: string
}

const NODE_MIN_WIDTH = 220
const NODE_MIN_HEIGHT = 80
const GAP_X = 80
const GAP_Y = 40
const PADDING = 40

export default function DAGView(props: Props) {
  const [translate, setTranslate] = createSignal({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = createSignal(false)
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 })

  // Calculate layout
  const layout = createMemo(() => {
    const tasks = props.tasks
    if (!tasks.length) return { nodes: [], edges: [], width: 0, height: 0, flatNodes: [] }

    // 1. Build Hierarchy
    const nodesMap = new Map<string, GraphNode>()
    tasks.forEach((t) => {
      nodesMap.set(t.id, {
        id: t.id,
        task: t,
        children: [],
        width: NODE_MIN_WIDTH,
        height: NODE_MIN_HEIGHT,
        x: 0,
        y: 0,
        globalX: 0,
        globalY: 0
      })
    })

    const roots: GraphNode[] = []

    nodesMap.forEach((node) => {
      if (node.task.parent_id && nodesMap.has(node.task.parent_id)) {
        const parent = nodesMap.get(node.task.parent_id)!
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    // 2. Recursive Layout Function
    const layoutGraph = (nodes: GraphNode[]): { width: number; height: number } => {
      if (nodes.length === 0) return { width: 0, height: 0 }

      // First, layout children recursively to determine their sizes
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          const { width, height } = layoutGraph(node.children)
          node.width = Math.max(NODE_MIN_WIDTH, width + PADDING * 2)
          node.height = Math.max(NODE_MIN_HEIGHT, height + PADDING * 2 + 30) // +30 for header
        }
      })

      // Now layout the current level (DAG layout)
      const layerMap = new Map<string, number>()

      // Helper to get layer
      const getLayer = (nodeId: string, visited = new Set<string>()): number => {
        if (visited.has(nodeId)) return 0
        if (layerMap.has(nodeId)) return layerMap.get(nodeId)!

        visited.add(nodeId)
        const node = nodesMap.get(nodeId)!

        let maxDepLayer = -1
        // Only consider dependencies that are siblings in this current graph level
        const siblingIds = new Set(nodes.map((n) => n.id))

        if (node.task.dependencies) {
          for (const depId of node.task.dependencies) {
            if (siblingIds.has(depId)) {
              const depLayer = getLayer(depId, new Set(visited))
              maxDepLayer = Math.max(maxDepLayer, depLayer)
            }
          }
        }

        const layer = maxDepLayer + 1
        layerMap.set(nodeId, layer)
        return layer
      }

      nodes.forEach((n) => getLayer(n.id))

      // Group by layer
      const layers: GraphNode[][] = []
      nodes.forEach((node) => {
        const layer = layerMap.get(node.id) || 0
        if (!layers[layer]) layers[layer] = []
        layers[layer].push(node)
      })

      // Assign coordinates
      let currentX = 0
      let maxHeight = 0

      layers.forEach((layerNodes) => {
        let currentY = 0
        let layerWidth = 0

        layerNodes.forEach((node) => {
          node.x = currentX
          node.y = currentY

          layerWidth = Math.max(layerWidth, node.width)
          currentY += node.height + GAP_Y
        })

        maxHeight = Math.max(maxHeight, currentY - GAP_Y)
        currentX += layerWidth + GAP_X
      })

      return { width: currentX - GAP_X, height: maxHeight }
    }

    // 3. Run Layout on Roots
    const { width, height } = layoutGraph(roots)

    // 4. Calculate Global Coordinates
    const flatNodes: GraphNode[] = []
    const calculateGlobal = (nodes: GraphNode[], parentX: number, parentY: number) => {
      nodes.forEach((node) => {
        node.globalX = parentX + node.x
        node.globalY = parentY + node.y
        flatNodes.push(node)

        if (node.children.length > 0) {
          // Children are offset by padding and header
          calculateGlobal(node.children, node.globalX + PADDING, node.globalY + PADDING + 30)
        }
      })
    }
    calculateGlobal(roots, 0, 0)

    // 5. Collect Edges (Global)
    const edges: Edge[] = []
    tasks.forEach((task) => {
      if (task.dependencies) {
        task.dependencies.forEach((depId) => {
          if (nodesMap.has(depId)) {
            edges.push({ source: depId, target: task.id })
          }
        })
      }
    })

    return { nodes: roots, edges, width, height, flatNodes }
  })

  const handleMouseDown = (e: MouseEvent) => {
    // Only drag if clicking background or specifically the container
    if (e.target instanceof Element && e.target.closest('.node-content')) return

    setIsDragging(true)
    setDragStart({ x: e.clientX - translate().x, y: e.clientY - translate().y })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return
    setTranslate({
      x: e.clientX - dragStart().x,
      y: e.clientY - dragStart().y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (e.target instanceof Element && e.target.closest('.node-content')) return

    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - translate().x, y: touch.clientY - translate().y })
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging()) return
    e.preventDefault()
    const touch = e.touches[0]
    setTranslate({
      x: touch.clientX - dragStart().x,
      y: touch.clientY - dragStart().y
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Global mouse/touch events for dragging
  createEffect(() => {
    if (isDragging()) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
    onCleanup(() => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    })
  })

  // Recursive Node Component
  const NodeView = (props: { node: GraphNode }) => {
    return (
      <div
        data-testid={`node-${props.node.task.title}`}
        class="absolute bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg shadow-sm flex flex-col transition-all"
        style={{
          left: `${props.node.x}px`,
          top: `${props.node.y}px`,
          width: `${props.node.width}px`,
          height: `${props.node.height}px`
        }}
      >
        {/* Header / Content */}
        <div class="node-content p-3 flex flex-col h-full relative z-10">
          <div class="font-medium text-sm truncate text-gray-900 dark:text-gray-100" title={props.node.task.title}>
            {props.node.task.title}
          </div>
          <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span
              class={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                props.node.task.status === 'done'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : props.node.task.status === 'in-progress'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {props.node.task.status}
            </span>
          </div>
        </div>

        {/* Children Container */}
        {props.node.children.length > 0 && (
          <div class="absolute top-[40px] left-[40px] right-[40px] bottom-[40px]">
            <For each={props.node.children}>{(child) => <NodeView node={child} />}</For>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      class="w-full h-full overflow-hidden bg-gray-50 dark:bg-[#0d1117] relative cursor-move select-none touch-none"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        class="absolute top-0 left-0 transition-transform duration-75 ease-out origin-top-left"
        style={{ transform: `translate(${translate().x}px, ${translate().y}px)` }}
      >
        {/* Edges Layer */}
        <svg
          data-testid="dag-svg"
          class="absolute top-0 left-0 pointer-events-none overflow-visible z-0"
          style={{ width: `${layout().width}px`, height: `${layout().height}px` }}
        >
          <For each={layout().edges}>
            {(edge) => {
              const sourceNode = layout().flatNodes.find((n) => n.id === edge.source)
              const targetNode = layout().flatNodes.find((n) => n.id === edge.target)
              if (!sourceNode || !targetNode) return null

              // Calculate connection points based on global coordinates
              // Source: Right side
              const startX = sourceNode.globalX + sourceNode.width
              const startY = sourceNode.globalY + (sourceNode.children.length > 0 ? 30 : sourceNode.height / 2)

              // Target: Left side
              const endX = targetNode.globalX
              const endY = targetNode.globalY + (targetNode.children.length > 0 ? 30 : targetNode.height / 2)

              const midX = (startX + endX) / 2

              // Orthogonal path
              const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`

              return (
                <path
                  d={path}
                  fill="none"
                  stroke="#9ca3af"
                  stroke-width="2"
                  marker-end="url(#arrowhead)"
                  opacity="0.6"
                />
              )
            }}
          </For>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
          </defs>
        </svg>

        {/* Nodes Layer */}
        <For each={layout().nodes}>{(node) => <NodeView node={node} />}</For>
      </div>

      <div class="absolute bottom-4 right-4 bg-white dark:bg-[#161b22] p-2 rounded shadow text-xs text-gray-500 pointer-events-none">
        Drag to pan • {layout().flatNodes.length} tasks
      </div>
    </div>
  )
}
