import * as fs from 'fs/promises'
import * as path from 'path'
import { AppPaths } from '../../config.js'

export interface WorkspaceMetadata {
  path: string
  name: string
  description?: string
  lastOpened: string
  tags: string[]
  techStack?: string[]
}

interface WorkspaceDB {
  workspaces: WorkspaceMetadata[]
}

export class WorkspaceRegistry {
  public static async init() {
    try {
      // Ensure directory exists just in case, though InitService typically handles this
      // await fs.mkdir(path.dirname(AppPaths.workspaces), { recursive: true }) 
      // Relying on AppPaths.workspaces being a full file path
      
      await fs.access(AppPaths.workspaces)
    } catch {
      await this.save({ workspaces: [] })
    }
  }

  private static async load(): Promise<WorkspaceDB> {
    try {
      const data = await fs.readFile(AppPaths.workspaces, 'utf-8')
      return JSON.parse(data)
    } catch {
      return { workspaces: [] }
    }
  }

  private static async save(db: WorkspaceDB) {
    await fs.writeFile(AppPaths.workspaces, JSON.stringify(db, null, 2), 'utf-8')
  }

  public static async registerWorkspace(wsPath: string) {
    const db = await this.load()
    const index = db.workspaces.findIndex((w) => w.path === wsPath)
    
    const now = new Date().toISOString()
    
    if (index >= 0) {
      db.workspaces[index].lastOpened = now
    } else {
      db.workspaces.push({
        path: wsPath,
        name: path.basename(wsPath),
        lastOpened: now,
        tags: []
      })
    }
    
    await this.save(db)
  }

  public static async getWorkspaces(): Promise<WorkspaceMetadata[]> {
    const db = await this.load()
    return db.workspaces.sort((a, b) => 
        new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
    )
  }

  public static async getWorkspace(wsPath: string): Promise<WorkspaceMetadata | undefined> {
    const db = await this.load()
    return db.workspaces.find(w => w.path === wsPath)
  }

  public static async updateMetadata(wsPath: string, updates: Partial<WorkspaceMetadata>) {
    const db = await this.load()
    const index = db.workspaces.findIndex((w) => w.path === wsPath)
    
    if (index >= 0) {
      db.workspaces[index] = { ...db.workspaces[index], ...updates }
      await this.save(db)
    }
  }
}
