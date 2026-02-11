import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import fg from 'fast-glob'

export interface SkillDefinition {
  name: string
  description: string
  content: string
  path: string
}

export class SkillsService {
  private skills: Map<string, SkillDefinition> = new Map()
  private initialized = false

  constructor() {}

  async initialize() {
    if (this.initialized) return
    await this.scanSkills()
    this.initialized = true
  }

  async scanSkills() {
    this.skills.clear()

    const locations = [
      path.join(os.homedir(), '.opencode', 'skills'),
      path.join(process.cwd(), '.opencode', 'skills'),
      // Legacy/Compatibility paths (optional, per docs)
      path.join(os.homedir(), '.config', 'opencode', 'skills')
    ]

    for (const loc of locations) {
      try {
        await fs.access(loc)
        const entries = await fg('*/SKILL.md', { cwd: loc, absolute: true })

        for (const entry of entries) {
          try {
            const content = await fs.readFile(entry, 'utf-8')
            const parsed = this.parseSkill(content)
            if (parsed) {
              this.skills.set(parsed.name, { ...parsed, path: entry })
            }
          } catch (err) {
            console.warn(`[SkillsService] Failed to load skill at ${entry}:`, err)
          }
        }
      } catch {
        // Directory doesn't exist, skip
      }
    }

    console.log(`[SkillsService] Loaded ${this.skills.size} skills`)
  }

  private parseSkill(raw: string): Omit<SkillDefinition, 'path'> | null {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) return null

    const frontmatter = match[1]
    const content = match[2].trim()

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)

    if (!nameMatch || !descMatch) return null

    return {
      name: nameMatch[1].trim(),
      description: descMatch[1].trim(),
      content
    }
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  getLoaderTool() {
    return {
      name: 'skill',
      description: 'Load a specialized skill/prompt by name. Use this to get detailed instructions for complex tasks.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the skill to load'
          }
        },
        required: ['name']
      },
      execute: async (args: { name: string }) => {
        const skill = this.getSkill(args.name)
        if (!skill) {
          throw new Error(
            `Skill "${args.name}" not found. Available skills: ${this.listSkills()
              .map((s) => s.name)
              .join(', ')}`
          )
        }
        return `## SKILL: ${skill.name}\n${skill.description}\n\n${skill.content}`
      }
    }
  }

  getCreatorTool() {
    return {
      name: 'create_skill',
      description: 'Create a new skill (SKILL.md) and make it available instantly.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the skill (kebab-case preferred)' },
          description: { type: 'string', description: 'Short description of what the skill does' },
          content: { type: 'string', description: 'The markdown content/prompt of the skill' }
        },
        required: ['name', 'description', 'content']
      },
      execute: async (args: { name: string; description: string; content: string }) => {
        const path = await this.saveSkill(args.name, args.description, args.content)
        return `Skill "${args.name}" created successfully at ${path}`
      }
    }
  }

  async saveSkill(name: string, description: string, content: string) {
    const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    const skillDir = path.join(process.cwd(), '.opencode', 'skills', safeName)
    const skillPath = path.join(skillDir, 'SKILL.md')

    await fs.mkdir(skillDir, { recursive: true })

    const fileContent = `---
name: ${name}
description: ${description}
---

${content}
`
    await fs.writeFile(skillPath, fileContent, 'utf-8')
    await this.scanSkills()
    return skillPath
  }
}

export const skillsService = new SkillsService()
