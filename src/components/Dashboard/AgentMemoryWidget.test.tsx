import { render, screen, waitFor, cleanup } from '@solidjs/testing-library'
import { describe, expect, it, vi, afterEach } from 'vitest'
import AgentMemoryWidget from './AgentMemoryWidget'
import * as agentsApi from '../../api/agents'

vi.mock('../../api/agents', () => ({
  getAgentMemory: vi.fn()
}))

describe('AgentMemoryWidget', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('displays lessons learned', async () => {
    vi.mocked(agentsApi.getAgentMemory).mockResolvedValue({ lessons: "## Lesson 1\nDon't do that." })
    render(() => <AgentMemoryWidget />)

    await waitFor(() => {
      expect(screen.getByText("Don't do that.")).toBeTruthy()
    })
  })

  it('displays empty state', async () => {
    vi.mocked(agentsApi.getAgentMemory).mockResolvedValue({ lessons: '' })
    render(() => <AgentMemoryWidget />)

    await waitFor(() => {
      expect(screen.getByText('No lessons learned yet.')).toBeTruthy()
    })
  })
})
