import { WorkflowDefinition, WorkflowStep, WorkflowCondition } from './workflow.definitions'
import { unwrap } from '../../utils'
import * as fs from 'node:fs/promises'

export interface PromptExecutor {
  execute(agent: string, prompt: string): Promise<string>
}

export class BackgroundPromptExecutor implements PromptExecutor {
  constructor(
    private client: any, // OpencodeClient
    private sessionId: string,
    private defaultModel: string
  ) {}

  async execute(agentName: string, prompt: string): Promise<string> {
    // 1. Resolve Agent Content

    // const agents = await this.manager.listAgents(this.folder)
    // const agentDef = agents.find((a) => a.name === agentName)

    // Fallback if agent not found? Use default or throw?
    // Using a generic system prompt if not found.
    // const agentContent = agentDef ? agentDef.content : `You are ${agentName}.`

    // 2. Resolve Model
    // TODO: Agent definition might specify a model. We should parse it.
    // For now, use default model from session or config.
    const [providerID, modelID] = this.defaultModel.split('/')
    let polling = false

    // Check history to determine if we need to send prompt or just wait
    let knownLastId = ''
    try {
      const allMsgsRes = await this.client.session.messages({ path: { id: this.sessionId }, query: { limit: 10 } })
      const allMsgs = (unwrap(allMsgsRes) as any[]) || []
      const sorted = allMsgs.sort((a, b) => (a.info?.time?.created || 0) - (b.info?.time?.created || 0))

      const last = sorted[sorted.length - 1]
      if (last) knownLastId = last.info?.id || last.id

      const secondLast = sorted[sorted.length - 2]

      const getText = (m: any) =>
        m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
      const getRole = (m: any) => m?.info?.role || m?.info?.author?.role

      if (
        last &&
        getRole(last) === 'assistant' &&
        secondLast &&
        getRole(secondLast) === 'user' &&
        getText(secondLast) === prompt
      ) {
        console.log(`[WorkflowExecutor] Found cached response for ${agentName}`)
        return getText(last)
      }

      if (last && getRole(last) === 'user' && getText(last) === prompt) {
        console.log(`[WorkflowExecutor] Found pending prompt for ${agentName}. waiting...`)
        polling = true
      }
    } catch (e) {
      console.warn('Failed to check history', e)
    }

    if (!polling) {
      // 3. Send Prompt
      let retryCount = 0
      while (retryCount < 5) {
        try {
          const res = await this.client.session.prompt({
            path: { id: this.sessionId },
            body: {
              parts: [{ type: 'text', text: prompt }],
              agent: agentName, // Use name so messages persist
              model: { providerID, modelID }
            }
          })

          if ((res as any).error) {
            console.warn(`[BackgroundExecutor] Prompt error (attempt ${retryCount + 1}):`, (res as any).error)
            await new Promise((r) => setTimeout(r, 2000))
            retryCount++
            continue
          }
          break // Success
        } catch (e) {
          console.error(`[BackgroundExecutor] Prompt exception (attempt ${retryCount + 1}):`, e)
          await new Promise((r) => setTimeout(r, 2000))
          retryCount++
        }
      }
      if (retryCount >= 5) throw new Error('Failed to send prompt after retries (Session likely busy)')
    }

    // 4. Poll for completion
    let attempts = 0
    let hasBusied = false
    
    // We can rely on message ID to detect new response
    const checkForNewMessage = async () => {
      try {
        const query: any = { limit: 5 }
        const allMsgsRes = await this.client.session.messages({ path: { id: this.sessionId }, query })
        const allMsgs = unwrap(allMsgsRes) as any[]
        const sorted = allMsgs.sort((a, b) => (b.info?.time?.created || 0) - (a.info?.time?.created || 0))
        
        const latest = sorted[0]
        if (!latest) return null
        
        // If the latest message is an assistant message and it is NOT the one we started with
        const latestId = latest.info?.id || latest.id
        if (latestId !== knownLastId && (latest.info?.role === 'assistant' || latest.info?.author?.role === 'assistant')) {
          return latest
        }
      } catch (e) {
        console.warn('Check message error:', e)
      }
      return null
    }

    while (true) {
      if (attempts > 300) throw new Error('Timeout waiting for LLM') // 5 minutes max
      await new Promise((r) => setTimeout(r, 1000))

      // Optimization: Check for message existence directly
      const newMsg = await checkForNewMessage()
      if (newMsg) {
        return newMsg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
      }

      const statusRes = await this.client.session.status({ path: { id: this.sessionId } })
      if (statusRes.error) throw statusRes.error

      const status = unwrap(statusRes) as Record<string, { type: string }>
      const myStatus = status[this.sessionId]

      if (myStatus?.type === 'busy') hasBusied = true

      if (!myStatus || myStatus.type !== 'busy') {
        // If we haven't seen busy yet, we might be too fast?
        // Or if status is missing, we assume done?
        if (hasBusied || attempts > 2) {
          break
        }
      }
      attempts++
    }

    // 5. Fetch last message with consistency retries
    let consistencyAttempts = 0
    while (consistencyAttempts < 15) {
      const allMsgsRes = await this.client.session.messages({ path: { id: this.sessionId }, query: { limit: 10 } })
      const allMsgs = unwrap(allMsgsRes) as any[]

      const lastMsg = allMsgs.sort((a, b) => {
        const timeA = a.info?.time?.created || 0
        const timeB = b.info?.time?.created || 0
        return timeB - timeA
      })[0]

      // Validate we got a response
      if (!lastMsg) {
        // If no messages at all, wait and retry?
        await new Promise((r) => setTimeout(r, 1000))
        consistencyAttempts++
        continue
      }

      // Ensure we didn't just pick up the old message from before we sent the prompt
      const lastId = lastMsg.info?.id || lastMsg.id
      if (lastId === knownLastId) {
        // We found the SAME message ID as before we started.
        console.log(`[WorkflowExecutor] Stale ID ($ {lastId}). Waiting for index... (${consistencyAttempts + 1}/15)`)
        await new Promise((r) => setTimeout(r, 2000))
        consistencyAttempts++
        continue
      }

      const role = lastMsg.info?.author?.role || lastMsg.info?.role
      if (role === 'user') {
        // Last message is user? Agent hasn't replied yet.
        console.log(`[WorkflowExecutor] Last message is USER. Waiting for reply... (${consistencyAttempts + 1}/15)`)
        await new Promise((r) => setTimeout(r, 2000))
        consistencyAttempts++
        continue
      }

      // Success!
      return lastMsg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n')
    }

    throw new Error(`Agent did not produce a new message after ${consistencyAttempts} retries. (Stale ID)`)
  }
}

export interface WorkflowResult {
  outcome: string
  reason: string
  bootstrap?: any
  rounds: any[]
}

interface TemplateScope {
  user: Record<string, any>
  run: { id: string }
  state: Record<string, string>
  steps: Record<string, any>
  round: number
  maxRounds: number
  bootstrap?: any
  current?: any
  currentStepKey?: string
  roundsLog?: any[]
}

export class WorkflowEngine {
  constructor(private executor: PromptExecutor) {}

  async run(workflow: WorkflowDefinition, inputs: Record<string, any>, stateFile?: string): Promise<WorkflowResult> {
    const runId = (inputs.runId as string) || `req-${Date.now()}`
    let scope: TemplateScope | undefined

    if (stateFile) {
      try {
        const raw = await fs.readFile(stateFile, 'utf8')
        scope = JSON.parse(raw)
        // console.log('Resumed workflow from', stateFile)
      } catch {}
    }

    if (!scope) {
      // Initialize Scope
      scope = {
        user: { ...workflow.user, ...inputs },
        run: { id: runId },
        state: { ...workflow.state?.initial },
        steps: {},
        round: 0,
        maxRounds: workflow.flow.round.maxRounds || 10,
        roundsLog: []
      }

      // Resolve initial state templates
      for (const key in scope.state) {
        scope.state[key] = this.renderTemplate(scope.state[key], scope)
      }
    }

    const persist = async () => {
      if (stateFile) {
        try {
          await fs.writeFile(stateFile, JSON.stringify(scope, null, 2))
        } catch (err) {
          console.error('[WorkflowEngine] Failed to persist state:', err)
        }
      }
    }

    // Initial persistence to ensure file exists and marks start
    await persist()

    // BOOTSTRAP
    let bootstrapResult = scope.bootstrap
    if (workflow.flow.bootstrap && !bootstrapResult) {
      const stepMsgPromise = this.executeStep(workflow.flow.bootstrap, scope, workflow)
      bootstrapResult = await stepMsgPromise

      // Update scope with bootstrap result (globally available)
      scope.bootstrap = bootstrapResult
      scope.current = bootstrapResult // Consistent access for state updates

      // Apply state updates
      if (workflow.flow.bootstrap.stateUpdates) {
        this.applyStateUpdates(workflow.flow.bootstrap.stateUpdates, scope)
      }
      await persist()
    } else if (bootstrapResult) {
      scope.current = bootstrapResult
    }

    // ROUNDS
    const roundsLog = scope.roundsLog || []
    if (!scope.roundsLog) scope.roundsLog = roundsLog

    let finalOutcome = null
    const roundDef = workflow.flow.round

    // Start from current round if valid
    const startRound = scope.round && scope.round > 0 ? scope.round : 1

    for (let i = startRound; i <= scope.maxRounds; i++) {
      scope.round = i
      // If we are resuming mid-round, scope.steps has partial data
      // If this is a new round (i > startRound or if we just started), reset steps
      // Wait, if we just loaded scope and i == scope.round, we keep scope.steps!
      // If we iterate to next round, we clear it.

      const isResumedRound = i === startRound && scope.steps && Object.keys(scope.steps).length > 0
      if (!isResumedRound) {
        scope.steps = {}
      }

      const roundSteps = scope.steps

      // Find start step
      const startStepKey = roundDef.steps[0].key
      let currentStepKey: string | undefined = scope.currentStepKey || startStepKey

      let stepIterations = 0
      const maxStepIterations = roundDef.steps.length * 3

      while (currentStepKey && !finalOutcome) {
        stepIterations++
        if (stepIterations > maxStepIterations) throw new Error('Workflow cycle limit exceeded')

        const stepDef = roundDef.steps.find((s) => s.key === currentStepKey)
        if (!stepDef) throw new Error(`Step ${currentStepKey} not found`)

        // Save current step intention?
        scope.currentStepKey = currentStepKey
        await persist()

        // Execute Step
        // Always call executeStep. The lower-level executor handles idempotency via history checks.
        // This ensures that if we loop back to a step (recursion), we actually try to run it again,
        // rather than using a stale result from the map.

        let result = await this.executeStep(stepDef, scope, workflow)
        roundSteps[stepDef.key] = result

        scope.current = result // Expose current for conditions
        // IMPORTANT: We need to re-persist scope because executeStep calls changed valid state?
        // Actually, we persist before transition.

        // Apply State Updates
        if (stepDef.stateUpdates) this.applyStateUpdates(stepDef.stateUpdates, scope)

        // Check Transitions
        let transition = this.resolveTransition(stepDef.transitions, scope, result)

        if (transition) {
          if (transition.stateUpdates) this.applyStateUpdates(transition.stateUpdates, scope)

          if (transition.outcome) {
            finalOutcome = { outcome: transition.outcome, reason: transition.reason || transition.outcome }
            await persist()
            break
          } else if (transition.nextStep) {
            currentStepKey = transition.nextStep
            await persist()
            continue
          }
        }

        // Check Exits
        transition = this.resolveTransition(stepDef.exits, scope, result)
        if (transition) {
          if (transition.stateUpdates) this.applyStateUpdates(transition.stateUpdates, scope)

          if (transition.outcome) {
            finalOutcome = { outcome: transition.outcome, reason: transition.reason || transition.outcome }
            await persist()
            break
          } else if (transition.nextStep) {
            currentStepKey = transition.nextStep
            await persist()
            continue
          }
        }

        // Default Next
        currentStepKey = stepDef.next || this.findNextStepInArray(roundDef.steps, stepDef.key)
        await persist()
      }

      // Update rounds log
      // If we are re-running a round, we overwrite the entry
      const existingIdx = roundsLog.findIndex((r) => r.round === i)
      if (existingIdx !== -1) {
        roundsLog[existingIdx] = { round: i, steps: { ...roundSteps } }
      } else {
        roundsLog.push({ round: i, steps: { ...roundSteps } })
      }

      delete scope.currentStepKey // Reset for next round start
      await persist()

      if (finalOutcome) break
    }

    if (!finalOutcome) {
      finalOutcome = workflow.flow.round.defaultOutcome
    }

    // Resolve final reason template
    finalOutcome.reason = this.renderTemplate(finalOutcome.reason, scope)

    return {
      outcome: finalOutcome.outcome,
      reason: finalOutcome.reason,
      bootstrap: bootstrapResult,
      rounds: roundsLog
    }
  }

  private findNextStepInArray(steps: WorkflowStep[], currentKey: string): string | undefined {
    const idx = steps.findIndex((s) => s.key === currentKey)
    if (idx >= 0 && idx < steps.length - 1) {
      return steps[idx + 1].key
    }
    return undefined
  }

  private async executeStep(step: WorkflowStep, scope: TemplateScope, workflow: WorkflowDefinition): Promise<any> {
    // Render Prompt
    let promptSections = Array.isArray(step.prompt) ? step.prompt : [step.prompt]
    const renderedPrompt = promptSections.map((p) => this.renderTemplate(p, scope)).join('\n\n')

    // System Prompt for Role
    const roleDef = workflow.roles[step.role]

    // Inject system prompt into the message if available
    const effectivePrompt = roleDef?.systemPrompt
      ? `SYSTEM INSTRUCTIONS:\n${roleDef.systemPrompt}\n\nUSER REQUEST:\n${renderedPrompt}`
      : renderedPrompt

    const agentName = step.agent || 'build'
    const rawOutput = await this.executor.execute(agentName, effectivePrompt)

    let parsed: any = rawOutput

    // Parse JSON if role has parser or just looks like JSON
    if (roleDef && (roleDef.parser || rawOutput.trim().startsWith('{') || rawOutput.includes('```json'))) {
      try {
        const jsonMatch = rawOutput.match(/```json\n([\s\S]*?)\n```/) || rawOutput.match(/\{[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : rawOutput
        parsed = JSON.parse(jsonStr)
      } catch {
        // Failed to parse, keep as raw string or partial
      }
    }

    return {
      key: step.key,
      role: step.role,
      raw: rawOutput,
      parsed: parsed,
      type: 'agent'
    }
  }

  private resolveTransition(transitions: any[] | undefined, scope: TemplateScope, stepResult: any) {
    if (!transitions) return null
    for (const t of transitions) {
      if (this.matchesCondition(t.condition, scope, stepResult)) {
        return {
          outcome: t.outcome,
          reason: t.reason ? this.renderTemplate(t.reason, scope) : undefined,
          nextStep: t.nextStep,
          stateUpdates: t.stateUpdates
        }
      }
    }
    return null
  }

  private matchesCondition(condition: WorkflowCondition, scope: TemplateScope, stepResult: any): boolean {
    if (typeof condition === 'string' && condition === 'always') return true
    if (typeof condition === 'object') {
      // Field Condition
      const target = condition.field.startsWith('@') ? scope : stepResult
      const path = condition.field.startsWith('@') ? condition.field.substring(1) : condition.field
      const value = this.getValueAtPath(target, path)

      if (condition.exists !== undefined) {
        const exists = value !== undefined && value !== null && value !== ''
        if (condition.exists !== exists) return false
      }
      if (condition.equals !== undefined) {
        if (String(value) !== String(condition.equals)) return false
      }
      if (condition.notEquals !== undefined) {
        if (String(value) === String(condition.notEquals)) return false
      }
      if (condition.includes !== undefined) {
        if (!String(value).includes(condition.includes)) return false
      }

      return true
    }
    return false
  }

  private applyStateUpdates(updates: Record<string, string>, scope: TemplateScope) {
    for (const [key, tpl] of Object.entries(updates)) {
      scope.state[key] = this.renderTemplate(tpl, scope)
    }
  }

  private renderTemplate(template: string, scope: TemplateScope): string {
    return template.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
      const val = this.getValueAtPath(scope, expr.trim())
      if (val === undefined || val === null) return ''
      if (typeof val === 'object') return JSON.stringify(val, null, 2)
      return String(val)
    })
  }

  private getValueAtPath(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === undefined || current === null) return undefined
      current = current[part]
    }
    return current
  }
}
