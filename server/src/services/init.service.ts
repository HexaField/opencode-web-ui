import * as fs from 'fs/promises'
import { AppPaths } from '../config.js'

export class InitService {
  static async init() {
    console.log('Initializing user data directories at:', AppPaths.memory)

    await fs.mkdir(AppPaths.memory, { recursive: true })
    await fs.mkdir(AppPaths.telos, { recursive: true })
    await fs.mkdir(AppPaths.packs, { recursive: true })
    await fs.mkdir(AppPaths.config, { recursive: true })

    console.log('Initialization complete.')
  }
}
