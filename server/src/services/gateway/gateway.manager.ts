import { GatewayAdapter, UserMessage, AgentResponse } from './types.js'
import * as fs from 'fs'
import * as path from 'path'
import { AppPaths } from '../../config.js'
import { bus, Events } from '../event-bus.js'

interface AuthConfig {
  whitelist: string[]
}

export class GatewayManager {
  private static instance: GatewayManager
  private adapters: Map<string, GatewayAdapter> = new Map()
  private whitelist: Set<string> = new Set()

  private constructor() {
    this.loadAuth()
  }

  static getInstance(): GatewayManager {
    if (!GatewayManager.instance) {
      GatewayManager.instance = new GatewayManager()
    }
    return GatewayManager.instance
  }

  private loadAuth() {
    const authPath = path.join(AppPaths.config, 'auth.json')
    try {
      if (!fs.existsSync(AppPaths.config)) {
        fs.mkdirSync(AppPaths.config, { recursive: true })
      }

      if (fs.existsSync(authPath)) {
        const config: AuthConfig = JSON.parse(fs.readFileSync(authPath, 'utf-8'))
        this.whitelist = new Set(config.whitelist)
        console.log(`[Gateway] Loaded ${this.whitelist.size} allowed users.`)
      } else {
        console.warn('[Gateway] No auth.json found. Creating default with empty whitelist.')
        this.whitelist = new Set()
        fs.writeFileSync(authPath, JSON.stringify({ whitelist: [] }, null, 2))
      }
    } catch (error) {
      console.error('[Gateway] Failed to load auth.json:', error)
    }
  }

  registerAdapter(adapter: GatewayAdapter) {
    this.adapters.set(adapter.name, adapter)
    adapter.onMessage(async (msg) => this.handleMessage(msg))
    console.log(`[Gateway] Registered adapter: ${adapter.name}`)
  }

  async startAll() {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.start()
        console.log(`[Gateway] Started adapter: ${adapter.name}`)
      } catch (error) {
        console.error(`[Gateway] Failed to start adapter ${adapter.name}:`, error)
      }
    }
  }

  private async handleMessage(msg: UserMessage): Promise<AgentResponse | void> {
    console.log(`[Gateway] Received message from ${msg.userId} via ${msg.platform}`)

    if (!this.checkAuth(msg.userId)) {
      console.warn(`[Gateway] Unauthorized access attempt from: ${msg.userId}`)
      // Optionally reply with "Unauthorized"
      return
    }

    // Emit to EventBus for Agent to handle
    // We wrap this in a promise that resolves when the agent responds?
    // For now, the implementation plan says "Queues messages".
    // We'll emit an event.

    bus.emit(Events.GATEWAY_MESSAGE, msg)
  }

  async sendResponse(userId: string, content: string, platform?: string) {
    if (platform) {
      const adapter = this.adapters.get(platform)
      if (adapter) {
        await adapter.sendMessage(userId, content)
        return
      }
    }

    // If no platform specified or specific adapter failed, try to find one that knows this user?
    // For simplicity, we assume we know the platform from context usually.
    // Or we broadcast? No, that's spammy.
    // We'll default to the first one if we can't find it, or error.
    if (!platform) {
      console.warn(`[Gateway] No platform specified for response to ${userId}`)
      return
    }
    console.warn(`[Gateway] Adapter not found for platform: ${platform}`)
  }

  checkAuth(userId: string): boolean {
    return this.whitelist.has(userId)
  }
}

export const gatewayManager = GatewayManager.getInstance()
