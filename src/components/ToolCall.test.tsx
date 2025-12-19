import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { ToolPart } from '../types'
import ToolCall from './ToolCall'

describe('ToolCall', () => {
  it('renders list tool correctly', () => {
    const part: ToolPart = {
      id: '1',
      sessionID: 's1',
      messageID: 'm1',
      type: 'tool',
      tool: 'list',
      callID: 'c1',
      state: {
        status: 'completed',
        input: { path: '/test/path' },
        output: '/test/path\n',
        title: 'List',
        metadata: {},
        time: { start: 0, end: 1 }
      }
    }
    render(() => <ToolCall part={part} />)
    expect(screen.getByText('Tool: list')).toBeTruthy()
    // The content is inside a code block which is only visible when expanded
    // We need to click to expand first
    const toggle = screen.getByText('Tool: list')
    toggle.click()
    expect(screen.getAllByText((content) => content.includes('/test/path')).length).toBeGreaterThan(0)
  })

  it('renders write tool correctly', () => {
    const part: ToolPart = {
      id: '2',
      sessionID: 's1',
      messageID: 'm1',
      type: 'tool',
      tool: 'write',
      callID: 'c2',
      state: {
        status: 'completed',
        input: { filePath: '/test/file.txt', content: 'hello world' },
        output: '',
        title: 'Write',
        metadata: {},
        time: { start: 0, end: 1 }
      }
    }
    render(() => <ToolCall part={part} />)
    expect(screen.getByText('Tool: write')).toBeTruthy()
    // Expand to see details
    const toggle = screen.getByText('Tool: write')
    toggle.click()
    expect(screen.getByText((content) => content.includes('/test/file.txt'))).toBeTruthy()
    expect(screen.getByText((content) => content.includes('hello world'))).toBeTruthy()
  })
})
