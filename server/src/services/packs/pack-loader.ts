import * as fs from 'fs/promises'
import * as path from 'path'
import fg from 'fast-glob'
import { AppPaths } from '../../config.js'
import { PackManifest, ToolDefinition } from '../../types/packs.js'
import { toolRegistry } from '../tools/tool-registry.js'
import { pathToFileURL } from 'url'

export class PackLoader {
  private systemPacksDir: string

  constructor() {
    // Determine system packs location.
    // In dev: server/src/packs
    // In prod: dist/server/packs
    // We use process.cwd() for now as it's reliable in this project structure
    this.systemPacksDir = path.join(process.cwd(), 'server/src/packs')
  }

  async loadPacks() {
    console.log('[PackLoader] Loading system packs from:', this.systemPacksDir)
    await this.scanDirectory(this.systemPacksDir)

    console.log('[PackLoader] Loading user packs from:', AppPaths.packs)
    await this.scanDirectory(AppPaths.packs)
  }

  private async scanDirectory(rootDir: string) {
    try {
      await fs.access(rootDir)
    } catch {
      return // Directory doesn't exist
    }

    // Look for manifest.json files 2 levels deep (category/pack/manifest.json or just pack/manifest.json)
    const manifests = await fg('**/manifest.json', { 
      cwd: rootDir, 
      absolute: true,
      deep: 3 
    })

    for (const manifestPath of manifests) {
      await this.loadPack(path.dirname(manifestPath))
    }
  }

  private async loadPack(packDir: string) {
    try {
      const manifestPath = path.join(packDir, 'manifest.json')
      const toolsDefPath = path.join(packDir, 'tools.json')
      const indexPath = path.join(packDir, 'index.ts') // Or index.js in prod, but tsx handles ts

      // 1. Read Manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf8')
      const manifest = JSON.parse(manifestContent) as PackManifest

      // 2. Read Tools Definition
      // Some packs might not have tools (just internal libs), but usually they do.
      let toolsDefs: ToolDefinition[] = []
      try {
        const toolsContent = await fs.readFile(toolsDefPath, 'utf8')
        toolsDefs = JSON.parse(toolsContent) as ToolDefinition[]
      } catch (e) {
        console.warn(`[PackLoader] No tools.json found for pack ${manifest.name} or invalid JSON`)
      }

      // 3. Import Implementation
      // Using pathToFileURL to support ESM dynamic import on absolute paths on Windows/Unix
      let implModule: any
      try {
        implModule = await import(pathToFileURL(indexPath).href)
      } catch (e) {
        // Fallback to .js if .ts not found (production case)
        const jsPath = path.join(packDir, 'index.js')
        try {
          implModule = await import(pathToFileURL(jsPath).href)
        } catch (err) {
          console.error(`[PackLoader] Failed to import index for ${manifest.name}`, err)
          return
        }
      }

      // 4. Register Tools
      for (const def of toolsDefs) {
        const impl = implModule[def.name]
        if (typeof impl === 'function') {
          toolRegistry.registerTool(def, impl)
          console.log(`[PackLoader] Registered tool: ${def.name} from ${manifest.name}`)
        } else {
          console.warn(
            `[PackLoader] Tool ${def.name} defined in tools.json but exports.${def.name} is missing in index.ts`
          )
        }
      }
    } catch (error) {
      console.error(`[PackLoader] Error loading pack at ${packDir}:`, error)
    }
  }
}

export const packLoader = new PackLoader()
