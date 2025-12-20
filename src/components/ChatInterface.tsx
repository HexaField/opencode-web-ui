import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Message, Session, ToolPart } from '../types'
import ToolCall from './ToolCall'

interface Props {
  folder: string
  sessionId: string
}

export default function ChatInterface(props: Props) {
  const [messages, setMessages] = createSignal<Message[]>([])
  const [input, setInput] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}?folder=${encodeURIComponent(props.folder)}`)
      const data = (await res.json()) as unknown
      const session = data as Session
      if (session && Array.isArray(session.history)) {
        setMessages((prev) => {
          const newHistory = session.history
          // Check if we need to preserve the temp message
          const lastPrev = prev[prev.length - 1]
          if (lastPrev?.info.id.startsWith('temp-')) {
            // Check if newHistory contains this message (by content)
            const found = newHistory.find(
              (m) =>
                m.info.role === 'user' &&
                m.parts[0].type === 'text' &&
                (m.parts[0] as { text: string }).text === (lastPrev.parts[0] as { text: string }).text
            )
            if (!found) {
              return [...newHistory, lastPrev]
            }
          }
          return newHistory
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  createEffect(() => {
    if (props.sessionId) {
      setMessages([])
      setLoading(true)

      // Initial fetch
      void fetchSession().finally(() => setLoading(false))

      // Setup SSE
      const eventSource = new EventSource(
        `/api/sessions/${props.sessionId}/events?folder=${encodeURIComponent(props.folder)}`
      )

      eventSource.onmessage = (event) => {
        try {
          const session = JSON.parse(event.data as string) as Session
          if (session && Array.isArray(session.history)) {
            setMessages((prev) => {
              const newHistory = session.history
              // Check if we need to preserve the temp message
              const lastPrev = prev[prev.length - 1]
              if (lastPrev?.info.id.startsWith('temp-')) {
                // Check if newHistory contains this message (by content)
                const found = newHistory.find(
                  (m) =>
                    m.info.role === 'user' &&
                    m.parts[0].type === 'text' &&
                    (m.parts[0] as { text: string }).text === (lastPrev.parts[0] as { text: string }).text
                )
                if (!found) {
                  return [...newHistory, lastPrev]
                }
              }
              return newHistory
            })
          }
        } catch (error) {
          console.error('SSE Parse Error:', error)
        }
      }

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err)
        eventSource.close()
      }

      onCleanup(() => {
        eventSource.close()
      })
    }
  })

  const sendMessage = async () => {
    if (!input().trim() || loading()) return
    const text = input()
    setInput('')
    setLoading(true)

    // Optimistic update
    const tempMessage: Message = {
      info: {
        id: 'temp-' + Date.now(),
        sessionID: props.sessionId,
        role: 'user',
        time: { created: Date.now() },
        agent: 'user',
        model: { providerID: 'user', modelID: 'user' }
      },
      parts: [
        {
          id: 'temp-part-' + Date.now(),
          sessionID: props.sessionId,
          messageID: 'temp-' + Date.now(),
          type: 'text',
          text: text
        }
      ]
    }
    setMessages((prev) => [...prev, tempMessage])

    try {
      await fetch(`/api/sessions/${props.sessionId}/prompt?folder=${encodeURIComponent(props.folder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text }] })
      })
      await fetchSession()
    } catch (err) {
      console.error(err)
      const errorMessage: Message = {
        info: {
          id: 'error-' + Date.now(),
          sessionID: props.sessionId,
          role: 'assistant',
          time: { created: Date.now() },
          parentID: 'error-parent',
          modelID: 'error-model',
          providerID: 'error-provider',
          mode: 'chat',
          path: { cwd: '', root: '' },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
        },
        parts: [
          {
            id: 'error-part-' + Date.now(),
            sessionID: props.sessionId,
            messageID: 'error-' + Date.now(),
            type: 'text',
            text: `Error: ${err instanceof Error ? err.message : String(err)}`
          }
        ]
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex flex-col h-full bg-white dark:bg-[#0d1117] transition-colors duration-200">
      <div class="flex-1 overflow-y-auto p-2 md:p-4 flex flex-col space-y-4">
        <For each={messages()}>
          {(msg) => {
            const isUser = msg.info.role === 'user'
            return (
              <div class={`flex flex-col gap-1 w-full ${isUser ? 'items-end' : 'items-start'}`}>
                <For each={msg.parts}>
                  {(part) => (
                    <>
                      <Show when={part.type === 'text'}>
                        <div
                          data-testid={`message-${msg.info.role}`}
                          class={`
                            max-w-[85%] md:max-w-[75%] rounded-xl px-2 py-1 border shadow-sm
                            ${
                              isUser
                                ? 'bg-[#ddf4ff] dark:bg-[#1f6feb]/15 text-gray-900 dark:text-gray-100 border-[#54aeff]/40 dark:border-[#1f6feb]/40 rounded-br-sm'
                                : 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-[#30363d] rounded-bl-sm'
                            }
                          `}
                        >
                          <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {(part as { text: string }).text}
                          </pre>
                        </div>
                      </Show>
                      <Show when={part.type === 'tool'}>
                        <ToolCall part={part as ToolPart} />
                      </Show>
                    </>
                  )}
                </For>
              </div>
            )
          }}
        </For>
        <Show when={loading()}>
          <div class="flex items-center gap-2 p-2 self-start ml-2 text-gray-500 dark:text-gray-400 text-sm">
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
        </Show>
      </div>
      <div class="p-3 md:p-4 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117]">
        <div class="flex gap-2 max-w-4xl mx-auto">
          <textarea
            class="flex-1 border border-gray-300 dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#010409] text-gray-900 dark:text-gray-100 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows={1}
            style={{ 'min-height': '42px', 'max-height': '120px' }}
            value={input()}
            onInput={(e) => {
              setInput(e.currentTarget.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Type a message..."
          />
          <button
            class="bg-[#0969da] hover:bg-[#0860ca] text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            onClick={() => void sendMessage()}
            disabled={loading()}
            title="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
