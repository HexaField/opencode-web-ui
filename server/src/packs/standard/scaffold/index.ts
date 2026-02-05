import { TemplateLoader } from '../../../services/templates/template.loader.js'
import { WorkspaceRegistry } from '../../../services/workspaces/workspace.registry.js'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function list_templates() {
    return await TemplateLoader.listTemplates()
}

export async function scaffold_project(args: { template: string, path: string }) {
    const { template, path } = args
            
    if (template === 'monorepo') {
        const repo = 'https://github.com/hexafield/template-monorepo'
        await execAsync(`git clone ${repo} "${path}"`)
    } else {
        return `Template ${template} not yet implemented for local copying.`
    }
    
    await WorkspaceRegistry.registerWorkspace(path)
    
    return `Successfully created project at ${path} using template ${template}`
}
