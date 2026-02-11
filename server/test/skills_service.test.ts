import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SkillsService } from '../src/services/skills/skills.service'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('SkillsService', () => {
  let service: SkillsService
  let tmpDir: string

  beforeEach(async () => {
    service = new SkillsService()
    // create a temp dir for our test "project"
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-skills-test-'))

    // We can't easily change os.homedir() in node, but we can mock the paths inside the service if we wanted to be pure.
    // However, the service checks process.cwd()/.opencode/skills.
    // We can change process.cwd() for the test or spy on it?
    // Changing cwd is risky in tests running in parallel.

    // Instead of changing global state, let's subclass or modify the service to accept root paths, or just monkey-patch the scan logic for the test?
    // Actually, looking at the code I wrote:
    // path.join(process.cwd(), '.opencode', 'skills')

    // Let's modify the service to allow injecting search paths or overriding cwd would be cleaner architecture, but for now
    // let's try to pass paths to scan?
    // Or simpler: I will assume the service is hardcoded for now, but I can use `vi.spyOn(process, 'cwd')` safely in vitest if I am careful.
  })

  afterEach(async () => {
    // cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true })
    } catch {}
    vi.restoreAllMocks()
  })

  it('should parse a valid SKILL.md', async () => {
    // We will trick the service into looking in our tmpDir by mocking fast-glob or process.cwd
    // Actually, let's just make the scanSkills method accept an override for testing to be robust

    // But since I can't easily change the class I just wrote, let's just mock the glob call?
    // No, mocking external libraries is annoying.

    // Let's use spyOn(process, 'cwd')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const skillDir = path.join(tmpDir, '.opencode', 'skills', 'test-skill')
    await fs.mkdir(skillDir, { recursive: true })

    const skillContent = `---
name: test-skill
description: A test skill
---
Here is the prompt content.
`
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent)

    await service.initialize()

    const skills = service.listSkills()
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('test-skill')
    expect(skills[0].description).toBe('A test skill')
    expect(skills[0].content).toBe('Here is the prompt content.')
    expect(skills[0].path).toBe(path.join(skillDir, 'SKILL.md'))
  })

  it('should ignore invalid SKILL.md (missing fontmatter)', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const skillDir = path.join(tmpDir, '.opencode', 'skills', 'bad-skill')
    await fs.mkdir(skillDir, { recursive: true })

    const skillContent = `
This has no frontmatter
`
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent)

    await service.initialize()

    const skills = service.listSkills()
    expect(skills).toHaveLength(0)
  })

  it('should create a new skill and reload', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)

    const creator = service.getCreatorTool()
    await creator.execute({
      name: 'new-skill',
      description: 'Created dynamically',
      content: 'Dynamic content'
    })

    const skills = service.listSkills()
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('new-skill')

    // Check file existence
    const filePath = path.join(tmpDir, '.opencode', 'skills', 'new-skill', 'SKILL.md')
    const exists = await fs.stat(filePath).catch(() => false)
    expect(exists).toBeTruthy()

    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('name: new-skill')
    expect(content).toContain('Dynamic content')
  })
})
