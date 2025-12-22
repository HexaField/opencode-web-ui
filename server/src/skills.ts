import * as fs from 'fs/promises'
import yaml from 'js-yaml'
import * as path from 'path'

export interface Skill {
  name: string
  description: string
  content: string
  path: string
}

interface SkillFrontmatter {
  name?: string
  description?: string
  [key: string]: unknown
}

export class SkillManager {
  // Simple cache: folder -> skills
  private cache = new Map<string, Skill[]>()

  async loadSkills(folder: string): Promise<Skill[]> {
    const skillsDir = path.join(folder, '.agent', 'skills')
    try {
      await fs.access(skillsDir)
    } catch {
      return []
    }

    const entries = await fs.readdir(skillsDir, { withFileTypes: true })
    const skills: Skill[] = []

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name)
        const skillFile = path.join(skillPath, 'SKILL.md')
        try {
          const content = await fs.readFile(skillFile, 'utf-8')
          // Split by --- lines.
          // The file should start with ---, then frontmatter, then ---, then content.
          // So splitting by --- should give ['', frontmatter, content]
          const parts = content.split(/^---$/m)

          if (parts.length >= 3) {
            const rawFrontmatter = yaml.load(parts[1])
            const body = parts.slice(2).join('---').trim()

            if (
              typeof rawFrontmatter === 'object' &&
              rawFrontmatter !== null &&
              'name' in rawFrontmatter &&
              'description' in rawFrontmatter
            ) {
              const frontmatter = rawFrontmatter as SkillFrontmatter
              if (typeof frontmatter.name === 'string' && typeof frontmatter.description === 'string') {
                skills.push({
                  name: frontmatter.name,
                  description: frontmatter.description,
                  content: body,
                  path: skillPath
                })
              }
            }
          }
        } catch (e) {
          // Ignore invalid skills
          console.warn(`Failed to load skill from ${skillPath}:`, e)
        }
      }
    }

    this.cache.set(folder, skills)
    return skills
  }

  matchSkills(prompt: string, skills: Skill[]): Skill[] {
    const lowerPrompt = prompt.toLowerCase()
    return skills.filter((skill) => {
      // Check if skill name is mentioned
      if (lowerPrompt.includes(skill.name.toLowerCase())) return true
      
      // Check if significant words from description are mentioned
      // This is a heuristic and can be improved
      const words = skill.description.toLowerCase().split(/\s+/)
      const significantWords = words.filter(w => w.length > 4) // Filter out short words
      
      // If any significant word from description is in prompt, consider it a match
      // This might be too aggressive, but good for discovery
      return significantWords.some(word => lowerPrompt.includes(word))
    })
  }
}
