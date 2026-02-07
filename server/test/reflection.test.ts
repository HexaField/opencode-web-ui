import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReflectionService } from '../src/services/reflection/reflection.service.js'
import { learningService } from '../src/services/memory/learning.service.js'

// Mock dependencies
vi.mock('../src/services/memory/learning.service.js')

describe('ReflectionService', () => {
  let service: ReflectionService
  let mockLlm: any

  beforeEach(() => {
    vi.resetAllMocks()

    // Mock LLM function
    mockLlm = vi.fn()

    service = new ReflectionService(mockLlm)
  })

  it('should analyze a session and record facts and preferences', async () => {
    // Given a session with history
    const sessionHistory = [
      { role: 'user', text: 'I prefer using TypeScript for all new files.' },
      { role: 'assistant', text: 'Noted.' },
      { role: 'user', text: 'Also, the backup server is at 192.168.1.5' }
    ]

    // And the LLM returns structured JSON
    const mockResponse = JSON.stringify({
      facts: ['Backup server is 192.168.1.5'],
      preferences: ['User prefers TypeScript'],
      critique: 'Agent should confirm preferences explicitly.'
    })

    mockLlm.mockResolvedValue(mockResponse)

    // When
    await service.analyzeSession('sess_123', sessionHistory)

    // Then
    expect(mockLlm).toHaveBeenCalled()
    expect(learningService.recordLesson).toHaveBeenCalledWith('sess_123', 'Fact: Backup server is 192.168.1.5')
    expect(learningService.recordLesson).toHaveBeenCalledWith('sess_123', 'Preference: User prefers TypeScript')
  })

  it('should handle empty or invalid JSON gracefully', async () => {
    const sessionHistory = [{ role: 'user', text: 'hi' }]
    mockLlm.mockResolvedValue('Invalid JSON')

    await service.analyzeSession('sess_123', sessionHistory)

    expect(learningService.recordLesson).not.toHaveBeenCalled()
  })

  it('should ignore empty fields', async () => {
    const sessionHistory = [{ role: 'user', text: 'hi' }]
    mockLlm.mockResolvedValue(
      JSON.stringify({
        facts: [],
        preferences: [],
        critique: ''
      })
    )

    await service.analyzeSession('sess_123', sessionHistory)

    expect(learningService.recordLesson).not.toHaveBeenCalled()
  })
})
