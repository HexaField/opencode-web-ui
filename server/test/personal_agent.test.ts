import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PersonalAgent } from '../src/agent/PersonalAgent.js'
import { bus, Events } from '../src/services/event-bus.js'
import { OpencodeManager } from '../src/opencode.js'

vi.mock('../src/opencode.js')

describe('PersonalAgent', () => {
  let agent: PersonalAgent
  let mockManager: OpencodeManager

  beforeEach(() => {
    vi.useFakeTimers()
    mockManager = new OpencodeManager() as any
    agent = new PersonalAgent(mockManager)
  })

  afterEach(() => {
    agent.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should start and emit AGENT_START', () => {
    const spy = vi.spyOn(bus, 'emit')
    agent.start()
    expect(spy).toHaveBeenCalledWith(Events.AGENT_START)
  })

  it('should emit AGENT_TICK on interval', () => {
    const spy = vi.spyOn(bus, 'emit')
    agent.start()

    // Fast forward time
    vi.advanceTimersByTime(5100)
    expect(spy).toHaveBeenCalledWith(Events.AGENT_TICK)

    vi.advanceTimersByTime(5000)
    expect(spy).toHaveBeenCalledWith(Events.AGENT_TICK)
  })

  it('should stop and emit AGENT_STOP', () => {
    const spy = vi.spyOn(bus, 'emit')
    agent.start()
    agent.stop()
    expect(spy).toHaveBeenCalledWith(Events.AGENT_STOP)
  })
})
