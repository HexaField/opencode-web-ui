import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import ToolCall from './ToolCall'
import { ToolPart } from '../types'

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
    expect(screen.getAllByText(/\/test\/path/).length).toBeGreaterThan(0)
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
    expect(screen.getByText('/test/file.txt')).toBeTruthy()
    expect(screen.getByText('hello world')).toBeTruthy()
  })
})
