import express from 'express'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { AuthenticatedRequest, validate, withClient } from '../../middleware'
import { OpencodeManager } from '../../opencode'
import { unwrap } from '../../utils'
import { FolderQuerySchema } from '../common/common.schema'
import { FileReadSchema, FSDeleteSchema, FSListSchema, FSReadSchema, FSWriteSchema } from './files.schema'

export function registerFilesRoutes(app: express.Application, manager: OpencodeManager) {
  app.get('/api/files/status', validate(FolderQuerySchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const status = await client.file.status()
      const data = unwrap(status)
      res.json(data)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.get('/api/files/read', validate(FileReadSchema), withClient(manager), async (req, res) => {
    try {
      const client = (req as AuthenticatedRequest).opencodeClient!
      const filePath = req.query.path as string
      if (!filePath) {
        res.status(400).json({ error: 'Missing path query parameter' })
        return
      }
      const content = await client.file.read({ query: { path: filePath } })
      const data = unwrap(content)
      // Ensure we return an object with content property if the SDK returns raw string or similar
      if (typeof data === 'string') {
        res.json({ content: data })
      } else if (data && typeof data === 'object' && 'content' in data) {
        // Already in expected shape
        res.json(data)
      } else {
        // Fallback: try reading the file directly from the filesystem inside the folder
        try {
          const fsContent = await fs.readFile(path.join((req.query.folder as string) || '', filePath), 'utf-8')
          res.json({ content: fsContent })
        } catch {
          // If filesystem read fails, just return the raw data
          res.json(data)
        }
      }
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.get('/api/fs/list', validate(FSListSchema), async (req, res) => {
    const dirPath = (req.query.path as string) || os.homedir()
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const files = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name)
      }))
      // Sort directories first
      files.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name)
        return a.isDirectory ? -1 : 1
      })
      res.setHeader('x-current-path', dirPath)
      res.json(files)
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.get('/api/fs/read', validate(FSReadSchema), async (req, res) => {
    const filePath = req.query.path as string
    if (!filePath) {
      res.status(400).json({ error: 'Missing path' })
      return
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      res.json({ content })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/fs/write', validate(FSWriteSchema), async (req, res) => {
    const { path: filePath, content } = req.body as { path?: string; content?: string }
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'Missing path or content' })
      return
    }
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/fs/delete', validate(FSDeleteSchema), async (req, res) => {
    const { path: filePath } = req.body as { path?: string }
    if (!filePath) {
      res.status(400).json({ error: 'Missing path' })
      return
    }
    try {
      await fs.rm(filePath, { recursive: true, force: true })
      res.json({ success: true })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  // Return unified git diff for a single file (unified=3)
  app.get('/api/files/diff', validate(FileReadSchema), async (req, res) => {
    const folder = req.query.folder as string
    const filePath = req.query.path as string
    if (!folder || !filePath) {
      res.status(400).json({ error: 'Missing folder or path' })
      return
    }
    try {
      // Use git diff to get changes for this file
      // We want diff of working tree vs HEAD
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // Check if file is untracked
      const { stdout: statusOut } = await execAsync(`git status --porcelain "${filePath}"`, { cwd: folder })
      if (statusOut.trim().startsWith('??')) {
        // Untracked file, return empty diff or special indicator
        res.json({ diff: null, isNew: true })
        return
      }

      const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`, { cwd: folder })
      res.json({ diff: stdout })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })

  // Return summary of diffs (files changed, total added/removed lines)
  app.get('/api/files/diff-summary', validate(FolderQuerySchema), async (req, res) => {
    const folder = req.query.folder as string
    if (!folder) {
      res.status(400).json({ error: 'Missing folder' })
      return
    }
    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      // git diff --shortstat HEAD
      const { stdout } = await execAsync('git diff --shortstat HEAD', { cwd: folder })
      // Output format: " 1 file changed, 2 insertions(+), 1 deletion(-)"
      // Parse it
      const parts = stdout.trim().split(', ')
      let filesChanged = 0
      let added = 0
      let removed = 0

      parts.forEach((p) => {
        if (p.includes('file changed')) filesChanged = parseInt(p)
        if (p.includes('insertion')) added = parseInt(p)
        if (p.includes('deletion')) removed = parseInt(p)
      })

      // Also get list of changed files with stats
      // git diff --numstat HEAD
      const { stdout: numstat } = await execAsync('git diff --numstat HEAD', { cwd: folder })
      const details = numstat
        .trim()
        .split('\n')
        .filter((l) => l)
        .map((line) => {
          const [add, del, file] = line.split('\t')
          return {
            path: file,
            added: parseInt(add) || 0,
            removed: parseInt(del) || 0
          }
        })

      res.json({
        filesChanged,
        added,
        removed,
        details
      })
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: msg })
    }
  })
}
