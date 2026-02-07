import * as fs from 'fs/promises'
import * as path from 'path'
import { WorkspaceRegistry } from './workspace.registry.js'

export class ProjectInitializer {
  static async ensureInitialized(cwd: string) {
    const alignmentPath = path.join(cwd, '.pai', 'alignment.md')

    try {
      await fs.access(alignmentPath)
      // Exists, do nothing
    } catch {
      await this.initialize(cwd)
    }
  }

  private static async initialize(cwd: string) {
    console.log(`[ProjectInitializer] Initializing new project at ${cwd}`)

    // 1. Analyze
    let name = path.basename(cwd)
    let dependencies: string[] = []
    let description = 'Auto-generated project context.'

    try {
      const pkgPath = path.join(cwd, 'package.json')
      const pkgContent = await fs.readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent)
      if (pkg.name) name = pkg.name
      if (pkg.dependencies) dependencies = Object.keys(pkg.dependencies)
      if (pkg.devDependencies) dependencies.push(...Object.keys(pkg.devDependencies))
    } catch {
      // No package.json or invalid
    }

    try {
      const readmePath = path.join(cwd, 'README.md')
      const readme = await fs.readFile(readmePath, 'utf-8')
      description = readme.slice(0, 500).replace(/\n/g, ' ') // Simple summary
    } catch {
      // No README
    }

    // 2. Generate Alignment File
    const alignmentContent = `# Project Alignment: ${name}

## Description
${description}

## Tech Stack
${dependencies.join(', ')}

## Goals (Auto-Generated)
- [ ] Explore codebase
- [ ] Define precise project mission
`
    await fs.mkdir(path.join(cwd, '.pai'), { recursive: true })
    await fs.writeFile(path.join(cwd, '.pai', 'alignment.md'), alignmentContent)

    // 3. Update Registry
    await WorkspaceRegistry.updateMetadata(cwd, {
      techStack: dependencies,
      description: description.slice(0, 100)
    })
  }
}
