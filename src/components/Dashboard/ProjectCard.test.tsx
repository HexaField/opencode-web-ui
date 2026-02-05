import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library'
import { describe, expect, it, vi, afterEach } from 'vitest'
import ProjectCard from './ProjectCard'

describe('ProjectCard', () => {
  const mockProps = {
    name: 'My Project',
    path: '/tmp/my-project',
    tags: ['react', 'demo'],
    onOpen: vi.fn()
  }

  afterEach(() => cleanup())

  it('renders project details', () => {
    render(() => <ProjectCard {...mockProps} />)
    expect(screen.getByText('My Project')).toBeTruthy()
    expect(screen.getByText('/tmp/my-project')).toBeTruthy()
    expect(screen.getByText('react')).toBeTruthy()
  })

  it('calls onOpen when clicked', () => {
    render(() => <ProjectCard {...mockProps} />)
    fireEvent.click(screen.getByText('My Project'))
    expect(mockProps.onOpen).toHaveBeenCalledWith('/tmp/my-project')
  })
})
