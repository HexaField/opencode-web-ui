// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import FolderBrowser from './FolderBrowser'

describe('FolderBrowser', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders and fetches initial path', async () => {
    const mockEntries = [
      { name: 'folder1', isDirectory: true, path: '/root/folder1' },
      { name: 'file1.txt', isDirectory: false, path: '/root/file1.txt' }
    ]
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEntries),
      headers: { get: () => null }
    })

    render(() => <FolderBrowser onSelectFolder={() => {}} />)

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/fs/list'))
    await waitFor(() => expect(screen.getByText('folder1')).toBeTruthy())
    expect(screen.getByText('file1.txt')).toBeTruthy()
  })

  it('navigates into a folder', async () => {
    const initialEntries = [{ name: 'folder1', isDirectory: true, path: '/root/folder1' }]
    const folderEntries = [{ name: 'subfile.txt', isDirectory: false, path: '/root/folder1/subfile.txt' }]

    ;(global.fetch as Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(initialEntries), headers: { get: () => null } })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(folderEntries), headers: { get: () => null } })

    render(() => <FolderBrowser onSelectFolder={() => {}} />)

    await waitFor(() => expect(screen.getByText('folder1')).toBeTruthy())

    fireEvent.click(screen.getByText('folder1'))

    await waitFor(() => expect(screen.getByText('subfile.txt')).toBeTruthy())
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('path=%2Froot%2Ffolder1'))
  })

  it('selects the current folder', async () => {
    const onSelect = vi.fn()
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
      headers: { get: () => null }
    })

    render(() => <FolderBrowser onSelectFolder={onSelect} />)

    const button = await screen.findByText(/Select this folder/i)
    fireEvent.click(button)

    expect(onSelect).toHaveBeenCalled()
  })
})
