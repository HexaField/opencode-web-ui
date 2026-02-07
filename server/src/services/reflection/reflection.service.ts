import { learningService } from '../memory/learning.service.js'

export type LlmInferenceFn = (prompt: string, systemPrompt?: string) => Promise<string>

export interface ReflectionResult {
  facts: string[]
  preferences: string[]
  critique: string
}

export class ReflectionService {
  constructor(private llm: LlmInferenceFn) {}

  public async analyzeSession(sessionId: string, history: { role: string; text: string }[]): Promise<void> {
    if (history.length < 2) return // Too short to learn anything

    const conversationText = history.map((msg) => `${msg.role.toUpperCase()}: ${msg.text}`).join('\n\n')

    const systemPrompt = `You are a Reflection Agent.
Task: Analyze the conversation history and extract persistent information.
Goal: Extract facts and preferences that should be remembered.

Output JSON format:
{
  "facts": ["fact 1", "fact 2"],
  "preferences": ["pref 1", "pref 2"],
  "critique": "Self-critique of assistant performance"
}
Return ONLY valid JSON.`

    const prompt = `Analyze this conversation:\n\n${conversationText}`

    try {
      const response = await this.llm(prompt, systemPrompt)
      const sanitized = this.sanitizeJson(response)
      const data = JSON.parse(sanitized) as ReflectionResult

      await this.saveInsights(sessionId, data)
    } catch (error) {
      console.warn(`[Reflection] Failed to analyze session ${sessionId}:`, error)
    }
  }

  private sanitizeJson(input: string): string {
    // Remove markdown code blocks if present
    const match = input.match(/```json\s*([\s\S]*?)\s*```/)
    if (match) return match[1]
    return input.replace(/```/g, '')
  }

  private async saveInsights(sessionId: string, data: ReflectionResult) {
    if (Array.isArray(data.facts)) {
      for (const fact of data.facts) {
        if (fact.trim()) {
          await learningService.recordLesson(sessionId, `Fact: ${fact}`)
        }
      }
    }

    if (Array.isArray(data.preferences)) {
      for (const pref of data.preferences) {
        if (pref.trim()) {
          await learningService.recordLesson(sessionId, `Preference: ${pref}`)
        }
      }
    }

    // We could log critique somewhere, but Plan 11 focuses on Facts/Preferences for now.
  }
}
