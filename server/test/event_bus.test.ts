import { describe, it, expect, vi } from 'vitest'
import { EventBus, bus, Events } from '../src/services/event-bus.js'

describe('EventBus', () => {
  it('should be a singleton', () => {
    const bus1 = EventBus.getInstance()
    const bus2 = EventBus.getInstance()
    expect(bus1).toBe(bus2)
    expect(bus).toBe(bus1) // Exported instance should match
  })

  it('should emit and receive events', () => {
    const handler = vi.fn()
    bus.on(Events.AGENT_START, handler)

    bus.emit(Events.AGENT_START)
    expect(handler).toHaveBeenCalled()
    bus.off(Events.AGENT_START, handler)
  })
})
