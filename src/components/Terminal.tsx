import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'

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

  // Track window resize for mobile check
  createEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    onCleanup(() => window.removeEventListener('resize', onResize))
  })

  let isRendered = false

  onMount(() => {
    if (!terminalRef) return

    // Initialize xterm
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
      // Send initial resize
      if (term.cols && term.rows) {
        socket?.send(`__resize__:${JSON.stringify({ cols: term.cols, rows: term.rows })}`)
      }

      // Flush buffer
      while (messageBuffer.length > 0) {
        socket?.send(messageBuffer.shift()!)
      }
    }

    socket.onmessage = (event) => {
      term.write(event.data as string)
    }

    socket.onclose = () => {
      // Don't show error if we're just unmounting/re-connecting
      if (socket) {
        term.writeln('\n\x1b[31mConnection closed\x1b[0m')
      }
    }

    // Handle user input
    term.onData((data) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(data)
      } else {
        messageBuffer.push(data)
      }
    })

    // Handle backend resizing
    term.onResize((size) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(`__resize__:${JSON.stringify({ cols: size.cols, rows: size.rows })}`)
      }
    })

    let animationFrame: number
    // Handle container resizing (including mobile keyboard appearing)
    const resizeObserver = new ResizeObserver(() => {
      if (!term || !fitAddon) return

      // Use requestAnimationFrame for deterministic, smooth updates during resize/keyboard animation
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        fitAddon.fit()
        // Ensure prompt stays visible when view shrinks
        term.scrollToBottom()
      })
    })

    resizeObserver.observe(terminalRef)

    onCleanup(() => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      socket?.close()
      socket = null // Ensure we don't try to send data to a closed socket
      term?.dispose()
    })
  })

  // Handle visibility/mounting logic
  createEffect(() => {
    if (props.active && fitAddon && terminalRef && term) {
      if (!isRendered) {
        term.open(terminalRef)
        isRendered = true
      }

      // Small delay to ensure layout is computed before fitting
      requestAnimationFrame(() => {
        fitAddon.fit()
        term.scrollToBottom()
        // We do typically want to focus when the tab becomes active
        term.focus()
      })
    }
  })

  const sendKey = (key: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(key)
    }
    term.focus()
  }

  const toggleKeyboard = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!term) return

    // Check if xterm's textarea is focused
    const isFocused = document.activeElement?.className?.includes('xterm-helper-textarea')

    if (isFocused) {
      term.blur()
    } else {
      term.focus()
      // Mobile often needs a slight delay or double focus to ensure keyboard triggers
      // especially if focus was just on a button
      setTimeout(() => term.focus(), 100)
    }
  }

  return (
    <div class="flex h-full flex-col w-full bg-[#1e1e1e]">
      <Show when={isMobile()}>
        <div class="flex overflow-x-auto bg-gray-800 p-2 gap-2 text-white text-sm h-12 flex-shrink-0 items-center no-scrollbar">
          <button
            class="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 active:bg-gray-400 whitespace-nowrap flex items-center justify-center min-w-[40px]"
            onClick={toggleKeyboard}
            title="Toggle Keyboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
          </button>
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
      <div ref={terminalRef} class="flex-1 overflow-hidden" style={{ padding: '4px' }} />
    </div>
  )
}
