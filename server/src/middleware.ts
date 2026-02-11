import { OpencodeClient } from '@opencode-ai/sdk'
import express from 'express'
import { z } from 'zod'
import { OpencodeManager } from './opencode'
import * as path from 'path'
import * as fs from 'fs/promises'
import { USER_DATA_ROOT } from './config'

export interface AuthenticatedRequest extends express.Request {
  opencodeClient?: OpencodeClient
  targetFolder?: string
}

export const validate =
  (schema: z.ZodType<unknown>) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      schema.parse({
        body: req.body as unknown,
        query: req.query as unknown,
        params: req.params as unknown
      })
      next()
    } catch (error) {
      console.error('Validation error:', error)
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.issues })
      } else {
        res.status(500).json({ error: 'Internal Server Error' })
      }
    }
  }

async function resolveFolder(folder: string): Promise<string> {
  if (folder === 'AGENT') {
    const agentDir = path.join(USER_DATA_ROOT, 'AGENT')
    await fs.mkdir(agentDir, { recursive: true })
    return agentDir
  }
  return folder
}

export const withClient =
  (manager: OpencodeManager) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const folderParam = req.query.folder as string
    if (!folderParam) {
      res.status(400).json({ error: 'Missing folder query parameter' })
      return
    }
    try {
      const folder = await resolveFolder(folderParam)
      const client = await manager.connect(folder)
      ;(req as AuthenticatedRequest).opencodeClient = client
      ;(req as AuthenticatedRequest).targetFolder = folder
      next()
    } catch (error) {
      console.error(error)
      const msg = error instanceof Error ? error.message : String(error)
      res.status(500).json({ error: `Failed to connect: ${msg}` })
    }
  }

export const withFolder =
  (_manager: OpencodeManager) => async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const folderParam = req.query.folder as string
    if (!folderParam) {
      res.status(400).json({ error: 'Missing folder query parameter' })
      return
    }
    try {
      const folder = await resolveFolder(folderParam)
      // Set targetFolder without forcing a client connection
      ;(req as AuthenticatedRequest).targetFolder = folder
      next()
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Failed to resolve folder' })
    }
  }
