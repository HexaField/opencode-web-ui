import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { createStore, reconcile, unwrap } from 'solid-js/store'
import { abortSession, getSession, getSessionStatus, promptSession, updateSession } from '../api/sessions'
import { Message, Session, ToolPart } from '../types'
import AgentSettingsModal from './AgentSettingsModal'
import ThoughtChain from './ThoughtChain'
import ToolCall from './ToolCall'

interface Props {
  folder: string
  sessionId: string
}

export default function ChatInterface(props: Props) {
  const [messages, setMessages] = createStore<Message[]>([])
  const [input, setInput] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [currentAgent, setCurrentAgent] = createSignal<string>('')
  const [currentModel, setCurrentModel] = createSignal<string>('')
  const [isAgentSettingsOpen, setIsAgentSettingsOpen] = createSignal(false)
  const [agentStatus, setAgentStatus] = createSignal<string>('idle')

  // Determine if an agent is currently running for this session by
  // checking status from backend or message history fallback
  const isAgentRunning = () =>
    agentStatus() === 'running' ||
    messages.some(
      (m) =>
        m.info.role === 'assistant' && !(m.info.time && (m.info.time as unknown as { completed?: number }).completed)
    )

  const checkStatus = async () => {
    try {
      const { status } = await getSessionStatus(props.folder, props.sessionId)
      setAgentStatus(status)
    } catch (e) {
      console.error('Failed to check status', e)
    }
  }

  // Persist draft message per session to localStorage
  // Key format: chat:draft:<sessionId>
  createEffect(() => {
    // Load saved draft when sessionId changes
    if (!props.sessionId) return
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = `chat:draft:${props.sessionId}`
    const saved = window.localStorage.getItem(key)
    if (saved && input() === '') {
      setInput(saved)
    }
  })

  // Save draft whenever input changes
  createEffect(() => {
    if (!props.sessionId) return
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = `chat:draft:${props.sessionId}`
    try {
      window.localStorage.setItem(key, input())
    } catch (e) {
      // Ignore quota / write errors
      console.warn('Failed to persist draft to localStorage', e)
    }
  })

  // Scrolling and manual mode state
  const [messagesLoaded, setMessagesLoaded] = createSignal(false)
  const [manualMode, setManualMode] = createSignal(false)
  let scrollContainer: HTMLDivElement | undefined

  const scrollToBottom = (instant = true) => {
    if (!scrollContainer) return
    try {
      if (instant) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      } else {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' })
      }
    } catch {
      // ignore
    }
  }

  // Helper to determine if the user is at the bottom (within threshold)
  const isAtBottom = (): boolean => {
    if (!scrollContainer) return true
    const threshold = 20
    return scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight <= threshold
  }

  const onUserScroll = () => {
    // Ignore scrolls until messages are loaded for the first time
    if (!messagesLoaded()) return
    // If user scrolled to bottom, resume auto scroll
    if (isAtBottom()) {
      setManualMode(false)
    } else {
      setManualMode(true)
    }
  }

  const attachScrollListener = () => {
    if (!scrollContainer) return
    scrollContainer.addEventListener('scroll', onUserScroll, { passive: true })
  }

  const detachScrollListener = () => {
    if (!scrollContainer) return
    scrollContainer.removeEventListener('scroll', onUserScroll)
  }

  const fetchSession = async () => {
    try {
      const session = await getSession(props.folder, props.sessionId)
      if (session) {
        // Also check status when fetching session
        void checkStatus()

        setCurrentAgent(session.agent || '')
        setCurrentModel(session.model || '')

        if (Array.isArray(session.history)) {
          const newHistory = session.history
          // Check if we need to preserve the temp message
          const currentMessages = unwrap(messages)
          const lastPrev = currentMessages[currentMessages.length - 1]

          let nextMessages: Message[] = newHistory.map((m) => ({ ...m, id: m.info.id }))
          if (lastPrev?.info.id.startsWith('temp-')) {
            // Check if newHistory contains this message (by content)
            const found = newHistory.find(
              (m) =>
                m.info.role === 'user' &&
                m.parts[0].type === 'text' &&
                (m.parts[0] as { text: string }).text === (lastPrev.parts[0] as { text: string }).text
            )
            if (!found) {
              nextMessages = [...nextMessages, { ...lastPrev, id: lastPrev.info.id }]
            }
          }
          setMessages(reconcile(nextMessages))
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  createEffect(() => {
    if (props.sessionId) {
      // Reset state for new session
      setMessages([])
      setMessagesLoaded(false)
      setManualMode(false)
      detachScrollListener()

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
          if (session) {
            // Update status whenever we get a session update via SSE
            void checkStatus()

            if (session.agent !== undefined) setCurrentAgent(session.agent || '')
            if (session.model !== undefined) setCurrentModel(session.model || '')

            if (Array.isArray(session.history)) {
              const newHistory = session.history
              const currentMessages = unwrap(messages)
              const lastPrev = currentMessages[currentMessages.length - 1]

              let nextMessages: Message[] = newHistory.map((m) => ({ ...m, id: m.info.id }))
              if (lastPrev?.info.id.startsWith('temp-')) {
                // Check if newHistory contains this message (by content)
                const found = newHistory.find(
                  (m) =>
                    m.info.role === 'user' &&
                    m.parts[0].type === 'text' &&
                    (m.parts[0] as { text: string }).text === (lastPrev.parts[0] as { text: string }).text
                )
                if (!found) {
                  nextMessages = [...nextMessages, { ...lastPrev, id: lastPrev.info.id }]
                }
              }
              setMessages(reconcile(nextMessages))
            }
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

  // Scroll behavior: react to messages changes
  createEffect(() => {
    // If messages are loaded for the first time, ensure we scroll to bottom and start listening to user scrolls
    if (!messagesLoaded() && messages.length > 0) {
      // Ensure DOM updates have rendered
      requestAnimationFrame(() => {
        scrollToBottom(true)
        setMessagesLoaded(true)
        // Attach listener after initial scroll so a user trying to scroll before load doesn't flip mode
        attachScrollListener()
      })
      return
    }

    // For subsequent message updates: if not in manual mode, autoscroll
    if (messagesLoaded() && !manualMode()) {
      // Ensure DOM updates have rendered before scrolling
      requestAnimationFrame(() => scrollToBottom(true))
    }
  })

  const handleUpdateSession = async (agent: string, model: string) => {
    try {
      await updateSession(props.folder, props.sessionId, { agent, model })
      await fetchSession()
    } catch (err) {
      console.error('Failed to update session:', err)
    }
  }

  const sendMessage = async () => {
    // if an agent is running, do not send another message
    if (isAgentRunning()) return
    if (!input().trim() || loading()) return
    const text = input()
    setInput('')
    setLoading(true)

    // Optimistic update
    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
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
    setMessages(messages.length, tempMessage)

    try {
      await promptSession(props.folder, props.sessionId, { parts: [{ type: 'text', text }] })
      await fetchSession()
    } catch (err) {
      console.error(err)
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
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
      setMessages(messages.length, errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const abort = async () => {
    if (!props.sessionId) return
    setLoading(true)
    try {
      await abortSession(props.folder, props.sessionId)
      await fetchSession()
    } catch (err) {
      console.error('Failed to abort session:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex h-full flex-col bg-white transition-colors duration-200 dark:bg-[#0d1117]">
      <AgentSettingsModal
        isOpen={isAgentSettingsOpen()}
        onClose={() => setIsAgentSettingsOpen(false)}
        folder={props.folder}
        sessionId={props.sessionId}
        currentAgent={currentAgent()}
        currentModel={currentModel()}
        onSave={handleUpdateSession}
      />

      <div
        ref={(el) => (scrollContainer = el as HTMLDivElement | undefined)}
        class="flex flex-1 flex-col overflow-x-hidden overflow-y-auto p-1 md:p-2"
      >
        <For each={messages}>
          {(msg) => {
            const isUser = msg.info.role === 'user'
            return (
              <div class={`flex w-full flex-col gap-1 ${isUser ? "m-2 items-end" : 'items-start'}`}>
                <For each={msg.parts}>
                  {(part) => (
                    <>
                      <Show when={part.type === 'text'}>
                        <Show
                          when={
                            !isUser &&
                            currentModel().split('/').pop() === 'gemini-3-pro-preview' &&
                            (part as { text: string }).text.startsWith('thought:')
                          }
                          fallback={
                            <>
                              <div
                                data-testid={`message-${msg.info.role}`}
                                class={`max-w-[85%] rounded-xl border px-2 py-1 shadow-sm md:max-w-[75%] ${
                                  isUser
                                    ? "rounded-br-sm border-[#54aeff]/40 bg-[#ddf4ff] text-gray-900 dark:border-[#1f6feb]/40 dark:bg-[#1f6feb]/15 dark:text-gray-100"
                                    : "rounded-bl-sm border-gray-200 bg-white text-gray-900 dark:border-[#30363d] dark:bg-[#161b22] dark:text-gray-100"
                                } `}
                              >
                                <Show
                                  when={isUser}
                                  fallback={
                                    <div>
                                      <div
                                        class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                        style={{ 'font-size': '14px' }}
                                        innerHTML={DOMPurify.sanitize(
                                          marked.parse((part as { text: string }).text, { async: false })
                                        )}
                                      />
                                    </div>
                                  }
                                >
                                  <div>
                                    <pre class="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                                      {(part as { text: string }).text}
                                    </pre>
                                  </div>
                                </Show>
                              </div>

                              {/* Copy button placed beneath the message, outside the message border, aligned based on sender */}
                              <div class={`mt-0.5 ${isUser ? 'self-end' : 'self-start'}`}>
                                <button
                                  class="rounded px-1 pt-0 pb-0.5 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                                  title="Copy"
                                  aria-label="Copy message"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    try {
                                      void navigator.clipboard.writeText((part as { text: string }).text)
                                    } catch (err) {
                                      console.error('Copy failed', err)
                                    }
                                  }}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="h-3 w-3 text-gray-500 dark:text-gray-400"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <rect x="9" y="4" width="11" height="11" rx="2" />
                                    <rect x="4" y="9" width="11" height="11" rx="2" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          }
                        >
                          <ThoughtChain text={(part as { text: string }).text} />
                        </Show>
                      </Show>
                      <Show when={part.type === 'tool'}>
                        <ToolCall part={part as ToolPart} folder={props.folder} />
                      </Show>
                    </>
                  )}
                </For>
              </div>
            )
          }}
        </For>
        <Show when={loading()}>
          <div class="ml-2 flex items-center gap-2 self-start p-2 text-sm text-gray-500 dark:text-gray-400">
            <div class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 0ms"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 150ms"></div>
            <div class="h-2 w-2 animate-bounce rounded-full bg-gray-400" style="animation-delay: 300ms"></div>
          </div>
        </Show>
      </div>
      <div class="border-t border-gray-200 bg-white p-3 md:p-4 dark:border-[#30363d] dark:bg-[#0d1117]">
        <div class="mx-auto flex max-w-4xl items-end gap-2">
          <button
            onClick={() => setIsAgentSettingsOpen(true)}
            class="mb-0.5 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-[#21262d] dark:hover:text-gray-200"
            title={`Agent: ${currentAgent() || 'Default'}\nModel: ${currentModel() || 'Default'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <textarea
            class="flex-1 resize-none rounded-md border border-gray-300 bg-[#f6f8fa] p-2 text-sm text-gray-900 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-[#30363d] dark:bg-[#010409] dark:text-gray-100"
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
          <Show
            when={!isAgentRunning()}
            fallback={
              <button
                class="rounded-md bg-red-600 p-2 font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                onClick={() => void abort()}
                title="Stop"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <rect x="4" y="4" width="12" height="12" rx="2" />
                </svg>
              </button>
            }
          >
            <button
              class="rounded-md bg-[#0969da] p-2 font-medium text-white shadow-sm transition-colors hover:bg-[#0860ca] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void sendMessage()}
              disabled={loading()}
              title="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}
