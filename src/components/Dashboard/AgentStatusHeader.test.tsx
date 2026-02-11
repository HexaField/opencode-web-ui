import { render, screen, waitFor, cleanup } from '@solidjs/testing-library'
import { describe, expect, it, vi, afterEach } from 'vitest'
import AgentStatusHeader from './AgentStatusHeader'
import * as agentsApi from '../../api/agents'

vi.mock('../../api/agents', () => ({
  getAgentStatus: vi.fn()
}))

describe('AgentStatusHeader', () => {
  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('displays Idle status by default', async () => {
    vi.mocked(agentsApi.getAgentStatus).mockResolvedValue({ status: 'idle' })
    render(() => <AgentStatusHeader />)

    await waitFor(() => {
      expect(screen.getByText('System Status:')).toBeTruthy()
      expect(screen.getByText('Idle')).toBeTruthy()
    })
  })

  it('displays Thinking status when agent is busy', async () => {
    vi.mocked(agentsApi.getAgentStatus).mockResolvedValue({ status: 'thinking' })
    render(() => <AgentStatusHeader />)

    await waitFor(() => {
      expect(screen.getByText('Thinking')).toBeTruthy()
    })
  })
})
