import * as fs from 'fs/promises'
import { AppPaths } from '../config.js'
import { ragService } from './rag/rag.service.js'

export class InitService {
  static async init() {
    console.log('Initializing user data directories at:', AppPaths.memory)

    await fs.mkdir(AppPaths.memory, { recursive: true })
    await fs.mkdir(AppPaths.telos, { recursive: true })
    await fs.mkdir(AppPaths.packs, { recursive: true })
    await fs.mkdir(AppPaths.config, { recursive: true })
    await fs.mkdir(AppPaths.docs, { recursive: true })
    await fs.mkdir(AppPaths.media, { recursive: true })

    // Initialize RAG Service
    await ragService.initialize()

    console.log('Initialization complete.')
  }
}
