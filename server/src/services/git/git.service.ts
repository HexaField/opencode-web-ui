import express from 'express'
import {
  findGitRepositories,
  getCurrentBranch,
  getGitStatus,
  listGitBranches,
  runCopilotPrompt,
  runGitCommand
} from '../../git'
import { validate } from '../../middleware'
import { radicleService } from '../../radicle'
import { FolderQuerySchema } from '../common/common.schema'
import { ConnectSchema } from '../misc/misc.schema'
import { GitBranchSchema, GitCheckoutSchema, GitCommitSchema, GitPushPullSchema, GitStageSchema } from './git.schema'

export function registerGitRoutes(app: express.Application) {
  app.get('/api/git/radicle/status', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const isRepo = await radicleService.isRepo(folder)
      res.json({ isRepo })
    } catch (err) {
      console.error('Failed to check radicle status:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/radicle/init', async (req, res) => {
    const folder = req.body.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      await radicleService.initRepo(folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to init radicle repo:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.get('/api/git/repos', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const repos = await findGitRepositories(folder)
      res.json(repos)
    } catch (err) {
      console.error('Failed to find git repositories:', err)
      // Fallback to just scanning the root if recursive scan fails (e.g. find command issues)
      // But for now, let's assume it works or return empty
      res.json([folder])
    }
  })

  app.get('/api/git/status', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const status = await getGitStatus(folder)
      res.json(status)
    } catch (err) {
      console.error('Failed to get git status:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.get('/api/git/current-branch', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const branch = await getCurrentBranch(folder)
      res.json({ branch })
    } catch (err) {
      console.error('Failed to get current branch:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.get('/api/git/ahead-behind', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    const remote = (req.query.remote as string) || 'origin'
    let branch = req.query.branch as string | undefined

    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }

    try {
      if (!branch) {
        branch = await getCurrentBranch(folder)
      }

      try {
        // Check if the remote branch exists
        await runGitCommand(['rev-parse', '--verify', `${remote}/${branch}`], folder)
        // remote branch exists, compare
        const out = await runGitCommand(
          ['rev-list', '--left-right', '--count', `${remote}/${branch}...${branch}`],
          folder
        )
        const parts = out.trim().split(/\s+/)
        let behind = 0
        let ahead = 0
        if (parts.length >= 2) {
          behind = Number(parts[0])
          ahead = Number(parts[1])
        }
        res.json({ ahead, behind })
      } catch {
        // remote branch doesn't exist; compute commits on branch not on any remote
        try {
          const out = await runGitCommand(['rev-list', '--count', branch, '--not', '--remotes'], folder)
          const ahead = Number(out.trim() || '0')
          res.json({ ahead, behind: 0 })
        } catch (err) {
          console.error('Failed to compute ahead count:', err)
          res.json({ ahead: 0, behind: 0 })
        }
      }
    } catch (err) {
      console.error('Failed to get ahead/behind:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.get('/api/git/branches', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const branches = await listGitBranches(folder)
      res.json(branches)
    } catch (err) {
      console.error('Failed to list branches:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/stage', validate(GitStageSchema), async (req, res) => {
    const { folder, files } = req.body as { folder?: string; files?: string[] }
    if (!folder || !files) {
      res.status(400).json({ error: 'Folder and files required' })
      return
    }
    try {
      await runGitCommand(['add', ...files], folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to stage files:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/unstage', validate(GitStageSchema), async (req, res) => {
    const { folder, files } = req.body as { folder?: string; files?: string[] }
    if (!folder || !files) {
      res.status(400).json({ error: 'Folder and files required' })
      return
    }
    try {
      await runGitCommand(['reset', 'HEAD', ...files], folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to unstage files:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/commit', validate(GitCommitSchema), async (req, res) => {
    const { folder, message } = req.body as { folder?: string; message?: string }
    if (!folder || !message) {
      res.status(400).json({ error: 'Folder and message required' })
      return
    }
    try {
      await runGitCommand(['commit', '-m', message], folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to commit:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/generate-commit-message', validate(ConnectSchema), async (req, res) => {
    const { folder } = req.body as { folder?: string }
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      let prompt = 'Generate a concise git commit message following conventional commit format (type: description). '
      let diffContext = ''
      try {
        diffContext = await runGitCommand(['diff', '--staged'], folder)
        if (!diffContext.trim()) {
          diffContext = await runGitCommand(['diff'], folder)
        }
      } catch {
        /* continue */
      }
      if (diffContext.trim()) {
        prompt += `Here are the changes:\n\n${diffContext}\n\n`
      } else {
        prompt += 'Analyze the repository changes and generate an appropriate commit message. '
      }
      prompt += 'Only return the commit message, nothing else.'

      const message = await runCopilotPrompt(prompt, folder)
      res.json({ message })
    } catch (err) {
      console.error('Failed to generate commit message:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/push', validate(GitPushPullSchema), async (req, res) => {
    const { folder, remote, branch } = req.body as { folder?: string; remote?: string; branch?: string }
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const args = ['push']
      if (remote) args.push(remote)
      if (branch) args.push(branch)
      await runGitCommand(args, folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to push:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/pull', validate(GitPushPullSchema), async (req, res) => {
    const { folder, remote, branch } = req.body as { folder?: string; remote?: string; branch?: string }
    if (!folder) {
      res.status(400).json({ error: 'Folder required' })
      return
    }
    try {
      const args = ['pull']
      if (remote) args.push(remote)
      if (branch) args.push(branch)
      await runGitCommand(args, folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to pull:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/checkout', validate(GitCheckoutSchema), async (req, res) => {
    const { folder, branch } = req.body as { folder?: string; branch?: string }
    if (!folder || !branch) {
      res.status(400).json({ error: 'Folder and branch required' })
      return
    }
    try {
      await runGitCommand(['checkout', branch], folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to checkout branch:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/branch', validate(GitBranchSchema), async (req, res) => {
    const { folder, branch, from } = req.body as { folder?: string; branch?: string; from?: string }
    if (!folder || !branch) {
      res.status(400).json({ error: 'Folder and branch required' })
      return
    }
    try {
      const args = ['branch', branch]
      if (from) args.push(from)
      await runGitCommand(args, folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to create branch:', err)
      res.status(500).json({ error: String(err) })
    }
  })

  app.post('/api/git/merge', validate(GitCheckoutSchema), async (req, res) => {
    const { folder, branch } = req.body as { folder?: string; branch?: string }
    if (!folder || !branch) {
      res.status(400).json({ error: 'Folder and branch required' })
      return
    }
    try {
      await runGitCommand(['merge', branch], folder)
      res.json({ success: true })
    } catch (err) {
      console.error('Failed to merge branch:', err)
      res.status(500).json({ error: String(err) })
    }
  })
}
