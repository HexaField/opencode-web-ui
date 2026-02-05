import { bus, Events } from '../event-bus.js'

export class SecurityService {
  private static instance: SecurityService
  
  // Simple blacklist for PoC
  private blacklist = [
    'rm -rf /',
    ':(){ :|:& };:', // Fork bomb
    '> /dev/sda',    // Wipe drive
    'mkfs'
  ]

  private constructor() {
    this.setupHooks()
  }

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService()
    }
    return SecurityService.instance
  }

  private setupHooks() {
    bus.on(Events.TOOL_PRE_EXECUTE, async (payload: { name: string, args: any }) => {
      await this.checkSecurity(payload)
    })
  }

  async checkSecurity(payload: { name: string, args: any }) {
    const { name, args } = payload
    
    // Intercept shell commands
    if (name === 'shell_exec') {
      const command = args.command as string
      
      if (!command) return

      if (this.isDangerous(command)) {
        throw new Error(`[Security] Action Denied by Security Policy: Command contains dangerous pattern.`)
      }
    }
  }

  private isDangerous(command: string): boolean {
    return this.blacklist.some(pattern => command.includes(pattern))
  }
}

export const securityService = SecurityService.getInstance()
