import { describe, expect, it } from 'vitest'
import { parseAgent, serializeAgent } from '../src/utils/frontmatter.js'

describe('Agent Frontmatter Parser', () => {
  it('should parse a complete agent file', () => {
    const content = `---
description: Test Agent
mode: subagent
model: gpt-4
permission:
  write: allow
  edit: deny
  bash: allow
  webfetch: allow
---
You are a test agent.
`
    const { config, prompt } = parseAgent(content)
    expect(config.description).toBe('Test Agent')
    expect(config.mode).toBe('subagent')
    expect(config.model).toBe('gpt-4')
    expect(config.permission).toEqual({
      write: 'allow',
      edit: 'deny',
      bash: 'allow',
      webfetch: 'allow'
    })
    expect(prompt).toBe('You are a test agent.')
  })

  it('should handle missing frontmatter', () => {
    const content = 'Just a prompt'
    const { config, prompt } = parseAgent(content)
    expect(prompt).toBe('Just a prompt')
    expect(config.description).toBe('')
  })

  it('should serialize an agent', () => {
    const config = {
      description: 'Serialized Agent',
      mode: 'primary' as const,
      model: 'claude-3',
      permission: {
        write: 'allow',
        edit: 'allow',
        bash: 'deny',
        webfetch: 'deny'
      }
    }
    const prompt = 'My System Prompt'

    const result = serializeAgent(config, prompt)
    expect(result).toContain('description: "Serialized Agent"')
    expect(result).toContain('mode: primary')
    expect(result).toContain('model: "claude-3"')
    expect(result).toContain('write: allow')
    expect(result).toContain('edit: allow')
    expect(result).toContain('bash: deny')
    expect(result).toContain('webfetch: deny')
    expect(result).toContain('---')
    expect(result).toContain('My System Prompt')
  })
})
