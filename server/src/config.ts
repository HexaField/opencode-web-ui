import * as os from 'os'
import * as path from 'path'

export const USER_DATA_ROOT = process.env.OPENCODE_USER_DATA || path.join(os.homedir(), '.opencode')

export const AGENTS_DASHBOARD_ROOT = path.join(USER_DATA_ROOT, 'AGENT')

export const AppPaths = {
  root: USER_DATA_ROOT,
  agents_dashboard: AGENTS_DASHBOARD_ROOT,
  memory: path.join(USER_DATA_ROOT, 'MEMORY'),
  telos: path.join(USER_DATA_ROOT, 'TELOS'),
  packs: path.join(USER_DATA_ROOT, 'PACKS'),
  config: path.join(USER_DATA_ROOT, 'CONFIG'),
  workspaces: path.join(USER_DATA_ROOT, 'MEMORY', 'workspaces.json'),
  templates: path.join(USER_DATA_ROOT, 'TEMPLATES'),
  docs: path.join(USER_DATA_ROOT, 'DOCS'),
  media: path.join(USER_DATA_ROOT, 'MEDIA')
}
