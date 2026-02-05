import { EventEmitter } from 'events'

export class EventBus extends EventEmitter {
  private static instance: EventBus

  private constructor() {
    super()
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  /**
   * Emits an event and waits for all listeners to complete sequentially.
   * If any listener throws an error, the process is aborted and the error bubbles up.
   */
  async emitAsync(event: string, ...args: any[]): Promise<void> {
    const listeners = this.listeners(event)
    for (const listener of listeners) {
      await (listener as Function)(...args)
    }
  }
}

export const bus = EventBus.getInstance()

export const Events = {
  AGENT_START: 'AGENT_START',
  AGENT_TICK: 'AGENT_TICK',
  AGENT_STOP: 'AGENT_STOP',
  TOOL_PRE_EXECUTE: 'TOOL_PRE_EXECUTE',
  TOOL_POST_EXECUTE: 'TOOL_POST_EXECUTE',
  SCHEDULE_TRIGGER: 'SCHEDULE_TRIGGER',
  GATEWAY_MESSAGE: 'GATEWAY_MESSAGE'
} as const
