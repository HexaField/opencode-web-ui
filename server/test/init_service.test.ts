import { describe, it, expect, vi } from 'vitest'
import { InitService } from '../src/services/init.service.js'
import * as fs from 'fs/promises'
import { AppPaths } from '../src/config.js'

vi.mock('fs/promises', () => ({
  mkdir: vi.fn()
}))

describe('InitService', () => {
  it('should create directories recursively', async () => {
    await InitService.init()

    expect(fs.mkdir).toHaveBeenCalledWith(AppPaths.memory, { recursive: true })
    expect(fs.mkdir).toHaveBeenCalledWith(AppPaths.packs, { recursive: true })
    expect(fs.mkdir).toHaveBeenCalledWith(AppPaths.config, { recursive: true })
  })
})
