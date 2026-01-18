// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import SearchPanel from './SearchPanel'

describe('SearchPanel', () => {
  const mockOnNavigate = vi.fn()

  // Setup mock fetch
  global.fetch = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders all search inputs', () => {
    render(() => <SearchPanel folder="/test/root" onNavigate={mockOnNavigate} />)

    expect(screen.getByPlaceholderText('Search')).toBeTruthy()
    expect(screen.getByPlaceholderText('Replace')).toBeTruthy()
    expect(screen.getByPlaceholderText('e.g. *.ts, src/**')).toBeTruthy() // Include params
    expect(screen.getByPlaceholderText('e.g. *.log, node_modules')).toBeTruthy() // Exclude params
    expect(screen.getByTitle('Match Case')).toBeTruthy()
  })

  it('triggers search after debounce', async () => {
    const mockResults = {
      results: [
        {
          fileName: 'test.ts',
          fullPath: '/test/root/test.ts',
          matches: [{ line: 1, character: 0, matchText: 'search', lineText: 'search query' }]
        }
      ]
    }

    // Mock a delayed response
    let resolveFetch: Function
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve
    })

    ;(global.fetch as Mock).mockReturnValue(
      fetchPromise.then(() => ({
        ok: true,
        json: () => Promise.resolve(mockResults)
      }))
    )

    render(() => <SearchPanel folder="/test/root" onNavigate={mockOnNavigate} />)

    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.input(searchInput, { target: { value: 'search' } })

    // Should not have called fetch yet, triggers "Searching..." immediately
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Searching...')).toBeTruthy()

    // Advance timer
    vi.advanceTimersByTime(500)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/fs/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"query":"search"')
      })
    )

    // With fetch pending, searching text should appear
    // Note: Effects are synchronous in Solid tests usually, but let's see
    expect(screen.getByText('Searching...')).toBeTruthy()

    // Resolve fetch
    resolveFetch!()

    await waitFor(() => {
      expect(screen.getByText('test.ts')).toBeTruthy()
    })

    // Searching text should be gone
    expect(screen.queryByText('Searching...')).toBeNull()
  })

  it('clears results when query is cleared', async () => {
    // First perform a search
    const mockResults = {
      results: [
        {
          fileName: 'test.ts',
          fullPath: '/test/root/test.ts',
          matches: [{ line: 1, character: 0, matchText: 'search', lineText: 'search query' }]
        }
      ]
    }
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults)
    })

    render(() => <SearchPanel folder="/test/root" onNavigate={mockOnNavigate} />)

    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.input(searchInput, { target: { value: 'search' } })
    vi.advanceTimersByTime(500)

    await waitFor(() => expect(screen.getByText('test.ts')).toBeTruthy())

    // Now clear the query
    fireEvent.input(searchInput, { target: { value: '' } })

    // Should clear results immediately without waiting for debounce
    // (Our code change ensured this)
    await waitFor(() => {
      expect(screen.queryByText('test.ts')).toBeNull()
    })

    // Ensure no new fetch was triggered for empty string
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('handles search error', async () => {
    ;(global.fetch as Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Search failed' })
    })

    render(() => <SearchPanel folder="/test/root" onNavigate={mockOnNavigate} />)

    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.input(searchInput, { target: { value: 'fail' } })
    vi.advanceTimersByTime(500)

    await waitFor(() => {
      expect(screen.getByText('Search failed')).toBeTruthy()
    })
  })

  it('updates search options and re-triggers search', async () => {
    const mockResults = { results: [] }
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResults)
    })

    render(() => <SearchPanel folder="/test/root" onNavigate={mockOnNavigate} />)

    // Set initial query
    const searchInput = screen.getByPlaceholderText('Search')
    fireEvent.input(searchInput, { target: { value: 'foo' } })
    vi.advanceTimersByTime(500)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/fs/search',
      expect.objectContaining({
        body: expect.stringContaining('"isCaseSensitive":false')
      })
    )

    // Toggle case sensitive
    const caseBtn = screen.getByTitle('Match Case')
    fireEvent.click(caseBtn)

    vi.advanceTimersByTime(500)

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/fs/search',
      expect.objectContaining({
        body: expect.stringContaining('"isCaseSensitive":true')
      })
    )
  })
})
