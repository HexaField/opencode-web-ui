// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as gitApi from '../api/git'
import RepoControl from './RepoControl'

// Mock api/git and api/files
vi.mock('../api/git', () => ({
  getGitStatus: vi.fn(),
  getCurrentBranch: vi.fn(),
  getAheadBehind: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  stageFiles: vi.fn(),
  unstageFiles: vi.fn(),
  checkRadicleStatus: vi.fn(),
  initRadicleRepo: vi.fn(),
  generateCommitMessage: vi.fn()
}))

vi.mock('../api/files', () => ({
  getFileDiff: vi.fn()
}))

describe('RepoControl', () => {
  const repoPath = '/test/repo'
  const rootDir = '/test'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks() // Ensure implementations are reset
    // Default mocks
    vi.mocked(gitApi.getGitStatus).mockResolvedValue([])
    vi.mocked(gitApi.getCurrentBranch).mockResolvedValue({ branch: 'main' })
    vi.mocked(gitApi.getAheadBehind).mockResolvedValue({ ahead: 0, behind: 0 })
    vi.mocked(gitApi.checkRadicleStatus).mockResolvedValue({ isRepo: true }) // Default to true (safe)
  })

  afterEach(() => {
    cleanup()
  })

  it('should render and check radicle status', async () => {
    vi.mocked(gitApi.checkRadicleStatus).mockResolvedValue({ isRepo: true })

    render(() => <RepoControl repoPath={repoPath} rootDir={rootDir} />)

    await waitFor(() => {
      expect(gitApi.checkRadicleStatus).toHaveBeenCalledWith(repoPath)
    })
  })

  it('should show Init Radicle button when not a radicle repo', async () => {
    vi.mocked(gitApi.checkRadicleStatus).mockResolvedValue({ isRepo: false })

    render(() => <RepoControl repoPath={repoPath} rootDir={rootDir} />)

    await waitFor(() => {
      // getByText throws if not found
      expect(screen.getByText('Init Radicle')).toBeTruthy()
    })
  })

  it('should not show Init Radicle button when is a radicle repo', async () => {
    vi.mocked(gitApi.checkRadicleStatus).mockResolvedValue({ isRepo: true })

    render(() => <RepoControl repoPath={repoPath} rootDir={rootDir} />)

    // Wait for check
    await waitFor(() => {
      expect(gitApi.checkRadicleStatus).toHaveBeenCalledWith(repoPath)
    })

    // Assert absence
    expect(screen.queryByText('Init Radicle')).toBeNull()
  })

  it('should initialize radicle repo when button is clicked', async () => {
    // Sequence: First false (show button), then true (after init success and refresh)
    // Actually, initRadicleRepo is called, then we fetchStatus.
    // So we can mock ResolvedValueOnce({isRepo: false}) then ResolvedValueOnce({isRepo: true})
    // But RepoControl logic calls fetchRadicleStatus on mount.
    // And then calls it again inside handleInitRadicle.

    vi.mocked(gitApi.checkRadicleStatus)
      .mockResolvedValueOnce({ isRepo: false }) // For mount
      .mockResolvedValueOnce({ isRepo: true }) // For refresh after init

    vi.mocked(gitApi.initRadicleRepo).mockResolvedValue(undefined)

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(() => <RepoControl repoPath={repoPath} rootDir={rootDir} />)

    const btn = await screen.findByText('Init Radicle')
    fireEvent.click(btn)

    expect(confirmSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(gitApi.initRadicleRepo).toHaveBeenCalledWith(repoPath)
    })

    // Should re-check status after init
    await waitFor(() => {
      expect(gitApi.checkRadicleStatus).toHaveBeenCalledTimes(2)
    })
  })
})
