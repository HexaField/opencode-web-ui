import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface Props {
  active: boolean
  folder: string
}

export default function TerminalComponent(props: Props) {
  let terminalRef: HTMLDivElement | undefined
  let term: Terminal
  let fitAddon: FitAddon
  let socket: WebSocket | null = null
  const messageBuffer: string[] = []
  const [isMobile, setIsMobile] = createSignal(window.innerWidth < 768)

  createEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  let isRendered = false

  // Initialize Terminal
  onMount(() => {
    if (!terminalRef) return

    term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e'
      }
    })

    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/terminal?folder=${encodeURIComponent(props.folder)}`

    socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      // Send resize
      socket?.send(`__resize__:${JSON.stringify({ cols: term.cols, rows: term.rows })}`)

      // Flush buffer
      while (messageBuffer.length > 0) {
        socket?.send(messageBuffer.shift()!)
      }
    }

    socket.onmessage = (event) => {
      term.write(event.data as string)
    }

    socket.onclose = () => {
      term.writeln('\n\x1b[31mConnection closed\x1b[0m')
    }

    term.onData((data) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      } else {
        messageBuffer.push(data)
      }
    })

    term.onResize((size) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(`__resize__:${JSON.stringify({ cols: size.cols, rows: size.rows })}`)
      }
    })

    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        // Check if terminal currently has focus
        // We need to restore it after fit() because fit() can cause blur on mobile
        const hasFocus = document.activeElement && terminalRef?.contains(document.activeElement)

        fitAddon.fit()

        if (hasFocus) {
          term.focus()
        }
      }, 250)
    }
    window.addEventListener('resize', handleResize)

    onCleanup(() => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    })
  })

  onCleanup(() => {
    socket?.close()
    term?.dispose()
  })

  // Refit when active changes
  createEffect(() => {
    if (props.active && fitAddon && terminalRef) {
      if (!isRendered) {
        term.open(terminalRef)
        isRendered = true
      }

      // Small delay to ensure container is sized
      setTimeout(() => {
        fitAddon.fit()
        term?.focus()
      }, 100)
    }
  })

  const sendKey = (key: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(key)
    }
    term.focus()
  }

  return (
    <div class="flex h-full flex-col w-full bg-[#1e1e1e]">
      <div ref={terminalRef} class="flex-1 overflow-hidden" style={{ padding: '4px' }} />
      <Show when={isMobile()}>
        <div class="flex overflow-x-auto bg-gray-800 p-2 gap-2 text-white text-sm h-12 flex-shrink-0 items-center no-scrollbar">
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x1b')}
          >
            Esc
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\t')}
          >
            Tab
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x1b[A')}
          >
            ↑
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x1b[B')}
          >
            ↓
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x1b[D')}
          >
            ←
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x1b[C')}
          >
            →
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('/')}
          >
            /
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('-')}
          >
            -
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('|')}
          >
            |
          </button>
          <button
            class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 active:bg-gray-500 whitespace-nowrap"
            onClick={() => sendKey('\x03')}
          >
            Ctrl+C
          </button>
        </div>
      </Show>
    </div>
  )
}
