import { render, screen, waitFor, cleanup } from '@solidjs/testing-library'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import GlobalChatWidget from './GlobalChatWidget'
import * as sessionsApi from '../../api/sessions'

// Mock ChatInterface to avoid complex dependency testing
vi.mock('../ChatInterface', () => ({
  default: () => <div data-testid="chat-interface">Mock Chat</div>
}))

vi.mock('../../api/sessions', () => ({
  createSession: vi.fn(),
  getSession: vi.fn()
}))

describe('GlobalChatWidget', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })
  
  afterEach(() => cleanup())

  it('initializes a new session if none exists', async () => {
    vi.mocked(sessionsApi.createSession).mockResolvedValue({ id: 'ses_new', slug: 'new-session' } as any)
    
    render(() => <GlobalChatWidget />)
    
    await waitFor(() => {
        expect(sessionsApi.createSession).toHaveBeenCalled()
        expect(screen.getByTestId('chat-interface')).toBeTruthy()
    })
  })

  it('restores existing session from local storage', async () => {
    localStorage.setItem('pai_global_session', 'ses_existing')
    
    render(() => <GlobalChatWidget />)
    
    await waitFor(() => {
        expect(sessionsApi.createSession).not.toHaveBeenCalled()
        expect(screen.getByTestId('chat-interface')).toBeTruthy()
    })
  })
})
