import * as os from 'os'
import * as path from 'path'

export const USER_DATA_ROOT = process.env.OPENCODE_USER_DATA || path.join(os.homedir(), '.opencode')

export const AppPaths = {
  memory: path.join(USER_DATA_ROOT, 'MEMORY'),
  telos: path.join(USER_DATA_ROOT, 'TELOS'),
  packs: path.join(USER_DATA_ROOT, 'PACKS'),
  config: path.join(USER_DATA_ROOT, 'CONFIG')
}
