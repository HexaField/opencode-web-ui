// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import ChatInterface from './ChatInterface'
import * as sessionsApi from '../api/sessions'
import { Message } from '../types'

// Mock the sessions API
vi.mock('../api/sessions', () => ({
  getSessionStatus: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn().mockResolvedValue({ id: 'session-new' }),
  promptSession: vi.fn(),
  branchSession: vi.fn().mockResolvedValue({ id: 'session-branched' }),
  updateSession: vi.fn(),
  abortSession: vi.fn(),
  revertSession: vi.fn(),
  unrevertSession: vi.fn()
}))

// Mock DOMPurify and Marked
vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html }
}))
vi.mock('marked', () => ({
  marked: { parse: (text: string) => text }
}))

describe('ChatInterface', () => {
  const folder = '/test/folder'
  const sessionId = 'session-123'

  // Helpers
  const createMessage = (id: string, text: string, role: 'user' | 'assistant' = 'user'): Message => ({
    id,
    info: {
      id,
      role,
      sessionID: sessionId,
      time: { created: Date.now() },
      agent: 'test',
      model: { providerID: 'test', modelID: 'test' },
      providerID: 'test',
      modelID: 'test',
      parentID: 'test-parent',
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      cost: 0,
      path: { cwd: folder, root: folder },
      mode: 'chat'
    },
    parts: [{ id: id + '-part', type: 'text', text, sessionID: sessionId, messageID: id }]
  })

  // Mock EventSource
  class MockEventSource {
    close = vi.fn()
    addEventListener = vi.fn()
  }
  global.EventSource = MockEventSource as any

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()

    // Default mocks
    ;(sessionsApi.getSessionStatus as Mock).mockResolvedValue({ status: 'idle' })
    ;(sessionsApi.getSession as Mock).mockResolvedValue({
      id: sessionId,
      history: [createMessage('msg-1', 'Hello', 'user'), createMessage('msg-2', 'Hi there', 'assistant')]
    })
    ;(sessionsApi.revertSession as Mock).mockResolvedValue({})
    ;(sessionsApi.promptSession as Mock).mockResolvedValue({})
    ;(sessionsApi.createSession as Mock).mockResolvedValue({ id: 'session-new' })
    ;(sessionsApi.branchSession as Mock).mockResolvedValue({ id: 'session-branched' })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // Helper to wait for messages to load
  const loadMessages = async (text = 'Hello') => {
    // Trigger effect
    await waitFor(() => expect(sessionsApi.getSession).toHaveBeenCalled())
    // Wait for rendering
    await screen.findByText(text)
  }

  it('renders messages and allows reverting', async () => {
    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages()

    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
  })

  it('enters edit mode and hides original content when editing a user message', async () => {
    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages()

    // Find edit button (title="Edit this message")
    const editButtons = screen.getAllByTitle('Edit this message')
    expect(editButtons.length).toBeGreaterThan(0)

    // Click edit on the first message
    fireEvent.click(editButtons[0])

    // Verify NO backend call yet
    expect(sessionsApi.revertSession).not.toHaveBeenCalled()

    // Check if textarea appears (Edit mode)
    await waitFor(() => expect(screen.getByPlaceholderText('Edit your message...')).toBeTruthy())

    const textarea = screen.getByPlaceholderText('Edit your message...') as HTMLTextAreaElement
    expect(textarea.value).toBe('Hello')

    // Verify original content is hidden
    const visibleEditButtons = screen.queryAllByTitle('Edit this message')
    // Should be one less than before (if we have multiple). We had 1 user message?
    // In mock: [User, Assistant]. So 1 user message.
    // If hidden, 0 buttons visible.
    expect(visibleEditButtons.length).toBe(0)
  })

  it('submits edited message', async () => {
    vi.useRealTimers()
    // Override history to have [User, Assistant, User2] so we can test reverting to User2's predecessor (Assistant)
    ;(sessionsApi.getSessionStatus as Mock).mockResolvedValue({ status: 'idle' })
    ;(sessionsApi.getSession as Mock).mockResolvedValue({
      id: sessionId,
      history: [
        createMessage('msg-1', 'Start', 'user'),
        createMessage('msg-2', 'Reply', 'assistant'),
        createMessage('msg-3', 'Hello', 'user')
      ]
    })

    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages() // Waits for "Hello"

    // Find edit buttons. Expect 2 (one for msg-1, one for msg-3)
    const editButtons = screen.getAllByTitle('Edit this message')
    // Click the second one (msg-3)
    fireEvent.click(editButtons[1])

    await waitFor(() => expect(screen.getByPlaceholderText('Edit your message...')).toBeTruthy())

    const textarea = screen.getByPlaceholderText('Edit your message...')
    fireEvent.input(textarea, { target: { value: 'Hello Edited' } })

    const sendButton = screen.getByText('Send')

    // Mock branchSession response
    ;(sessionsApi.branchSession as Mock).mockResolvedValue({ id: 'session-branched' })

    fireEvent.click(sendButton)

    // Verify branchSession called with msg-2 (predecessor of msg-3)
    await waitFor(() =>
      expect(sessionsApi.branchSession).toHaveBeenCalledWith(
        folder,
        sessionId,
        expect.objectContaining({
          messageID: 'msg-2',
          parts: expect.arrayContaining([expect.objectContaining({ text: 'Hello Edited' })])
        })
      )
    )

    // Should NOT call revert or prompt separately
    expect(sessionsApi.revertSession).not.toHaveBeenCalled()
    expect(sessionsApi.promptSession).not.toHaveBeenCalled()

    // Should exit edit mode
    await waitFor(() => expect(screen.queryByPlaceholderText('Edit your message...')).toBeNull())
  })

  it('cancels edit on escape without reverting', async () => {
    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages()

    // Edit msg-1
    const editButtons = screen.getAllByTitle('Edit this message')
    fireEvent.click(editButtons[0])

    await waitFor(() => expect(screen.getByPlaceholderText('Edit your message...')).toBeTruthy())

    // Press Escape
    const textarea = screen.getByPlaceholderText('Edit your message...')
    fireEvent.keyDown(textarea, { key: 'Escape' })

    // Should NOT call revert
    expect(sessionsApi.revertSession).not.toHaveBeenCalled()

    // Should exit edit mode
    await waitFor(() => expect(screen.queryByPlaceholderText('Edit your message...')).toBeNull())

    // Buttons should be back
    expect(screen.getAllByTitle('Edit this message').length).toBeGreaterThan(0)
  })

  it('aborts running session before submitting edit', async () => {
    // Mock status as running first, then idle
    ;(sessionsApi.getSessionStatus as Mock)
      .mockResolvedValueOnce({ status: 'running' }) // Initial check
      .mockResolvedValueOnce({ status: 'running' }) // Poll 1
      .mockResolvedValueOnce({ status: 'idle' }) // Poll 2

    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages()

    const editButtons = screen.getAllByTitle('Edit this message')
    fireEvent.click(editButtons[0])

    await waitFor(() => expect(screen.getByPlaceholderText('Edit your message...')).toBeTruthy())

    const sendButton = screen.getByText('Send')
    fireEvent.click(sendButton)

    await waitFor(() => expect(sessionsApi.abortSession).toHaveBeenCalledWith(folder, sessionId))
    // Move time forward for polling to complete
    await vi.advanceTimersByTimeAsync(1500)

    // Should proceed to revert and prompt
    await waitFor(() => expect(sessionsApi.promptSession).toHaveBeenCalled())
  })

  it('global undo button enters edit mode for last user message', async () => {
    // Mock history with multiple messages
    ;(sessionsApi.getSession as Mock).mockResolvedValue({
      id: sessionId,
      history: [
        createMessage('msg-1', 'User 1', 'user'),
        createMessage('msg-2', 'Assistant 1', 'assistant'),
        createMessage('msg-3', 'User 2', 'user'),
        createMessage('msg-4', 'Assistant 2', 'assistant')
      ]
    })

    render(() => <ChatInterface folder={folder} sessionId={sessionId} onSessionChange={vi.fn()} />)
    await loadMessages('User 1')

    const undoButton = screen.getByTitle('Undo')
    fireEvent.click(undoButton)

    await waitFor(() => expect(sessionsApi.revertSession).toHaveBeenCalledWith(folder, sessionId, 'msg-3'))

    // Should enter edit mode for User 2 (msg-3)
    await waitFor(() => expect(screen.getByPlaceholderText('Edit your message...')).toBeTruthy())
    const textarea = screen.getByPlaceholderText('Edit your message...') as HTMLTextAreaElement
    expect(textarea.value).toBe('User 2')
  })
})
