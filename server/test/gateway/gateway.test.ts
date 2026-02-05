import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gatewayManager } from '../../src/services/gateway/gateway.manager.js'
import { MockAdapter } from '../../src/services/gateway/mock.adapter.js'
import { bus, Events } from '../../src/services/event-bus.js'
import * as fs from 'fs'
import * as path from 'path'
import { AppPaths } from '../../src/config.js'

describe('Gateway Manager', () => {
    
    beforeEach(() => {
        // Reset auth.json to allow 'test-user'
        if (fs.existsSync(AppPaths.config)) {
             const authPath = path.join(AppPaths.config, 'auth.json')
             fs.writeFileSync(authPath, JSON.stringify({ whitelist: ['test-user'] }))
        } else {
             fs.mkdirSync(AppPaths.config, { recursive: true })
             const authPath = path.join(AppPaths.config, 'auth.json')
             fs.writeFileSync(authPath, JSON.stringify({ whitelist: ['test-user'] }))
        }
        
        // Reload auth in manager (we need to expose a reload method or just re-init if singleton allows, 
        // but since it's a singleton pattern, we might need to access the private method or restart the process.
        // For this test, we accept that the singleton might have loaded 'default' state,
        // so we manually check if we can update the whitelist.
        (gatewayManager as any).whitelist = new Set(['test-user'])
    })

    it('registers adapters', () => {
        const adapter = new MockAdapter()
        gatewayManager.registerAdapter(adapter)
        expect((gatewayManager as any).adapters.has('mock')).toBe(true)
    })

    it('emits GATEWAY_MESSAGE on valid authorized message', async () => {
        const adapter = new MockAdapter()
        gatewayManager.registerAdapter(adapter)
        
        const listener = vi.fn()
        bus.on(Events.GATEWAY_MESSAGE, listener)

        await adapter.simulateIncoming('test-user', 'Hello Agent')

        expect(listener).toHaveBeenCalled()
        const callArgs = listener.mock.calls[0][0]
        expect(callArgs.userId).toBe('test-user')
        expect(callArgs.content).toBe('Hello Agent')
    })
    
    it('ignores unauthorized messages', async () => {
         const adapter = new MockAdapter()
         gatewayManager.registerAdapter(adapter)
         
         const listener = vi.fn()
         bus.on(Events.GATEWAY_MESSAGE, listener)
 
         await adapter.simulateIncoming('stranger', 'Let me in')
 
         expect(listener).not.toHaveBeenCalled()
    })

})
