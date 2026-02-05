import * as fs from 'fs/promises'
import { AppPaths } from '../../config.js'

export class TemplateLoader {
    static async listTemplates(): Promise<string[]> {
        const builtIns = ['monorepo']
        try {
            const userTemplates = await fs.readdir(AppPaths.templates)
            return [...new Set([...builtIns, ...userTemplates])]
        } catch {
            return builtIns
        }
    }
}
