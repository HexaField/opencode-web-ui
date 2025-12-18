import { createEffect, createSignal, For, Show } from 'solid-js'

interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
}

interface Props {
  folder: string
  sessionId: string
}

export default function ChatInterface(props: Props) {
  const [messages, setMessages] = createSignal<Message[]>([])
  const [input, setInput] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  createEffect(() => {
    if (props.sessionId) {
      setMessages([])
      setLoading(true)
      fetch(`/sessions/${props.sessionId}?folder=${encodeURIComponent(props.folder)}`)
        .then((res) => res.json())
        .then((data: unknown) => {
          if (data && typeof data === 'object') {
            const d = data as Record<string, unknown>
            const hist = d.history
            if (Array.isArray(hist)) {
              const history = hist.map((msg: unknown) => {
                if (msg && typeof msg === 'object') {
                  const m = msg as Record<string, unknown>
                  let content = ''
                  if (Array.isArray(m.parts)) {
                    content = m.parts
                      .filter(
                        (p) =>
                          p &&
                          typeof p === 'object' &&
                          (p as Record<string, unknown>).type === 'text' &&
                          typeof (p as Record<string, unknown>).text === 'string'
                      )
                      .map((p) => String((p as Record<string, unknown>).text))
                      .join('\n')
                  }
                  const roleVal =
                    m.info && typeof m.info === 'object' && typeof (m.info as Record<string, unknown>).role === 'string'
                      ? ((m.info as Record<string, unknown>).role as 'user' | 'assistant')
                      : 'assistant'
                  return { role: roleVal, content: content || JSON.stringify(msg) }
                }
                return { role: 'assistant', content: JSON.stringify(msg) }
              })
              setMessages(history as Message[])
            }
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  })

  const sendMessage = async () => {
    if (!input().trim() || loading()) return
    const text = input()
    setInput('')
    setLoading(true)

    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      const res = await fetch(`/sessions/${props.sessionId}/prompt?folder=${encodeURIComponent(props.folder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text }] })
      })
      const data = (await res.json()) as { parts?: { type: string; text?: string }[] }

      // Handle response structure
      let content = ''
      if (data.parts) {
        content = data.parts
          .filter((p) => p.type === 'text' && p.text)
          .map((p) => p.text)
          .join('\n')
      } else {
        content = JSON.stringify(data, null, 2)
      }

      setMessages((prev) => [...prev, { role: 'assistant', content }])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + String(err) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex flex-col h-full bg-white dark:bg-[#0d1117] transition-colors duration-200">
      <div class="flex-1 overflow-y-auto p-2 md:p-4 flex flex-col space-y-4">
        <For each={messages()}>
          {(msg) => {
            const isUser = msg.role === 'user'
            return (
              <div
                class={`
                  max-w-[85%] md:max-w-[75%] rounded-xl px-4 py-3 border shadow-sm
                  ${
                    isUser
                      ? 'bg-[#ddf4ff] dark:bg-[#1f6feb]/15 text-gray-900 dark:text-gray-100 border-[#54aeff]/40 dark:border-[#1f6feb]/40 self-end rounded-br-sm'
                      : 'bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-[#30363d] self-start rounded-bl-sm'
                  }
                `}
              >
                <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
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
