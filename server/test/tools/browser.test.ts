import { describe, it, expect, vi } from 'vitest'
import { browser_launch, browser_navigate, browser_screenshot } from '../../src/packs/standard/browser/index.js'
import { browser } from '../../src/packs/standard/browser/browser-lib.js'

// Mock the library singleton to avoid real browser launch
vi.mock('../../src/packs/standard/browser/browser-lib.js', () => {
  return {
    browser: {
      launch: vi.fn(),
      navigate: vi.fn(),
      screenshot: vi.fn(),
      click: vi.fn(),
      fill: vi.fn(),
      getVisibleText: vi.fn(),
      close: vi.fn()
    }
  }
})

vi.mock('fs', () => {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  }
})

describe('Pack: Browser', () => {
  it('browser_launch calls library launch', async () => {
    await browser_launch({ headless: true })
    expect(browser.launch).toHaveBeenCalledWith({ headless: true, userAgent: undefined })
  })

  it('browser_navigate calls library navigate', async () => {
    await browser_navigate({ url: 'https://example.com' })
    expect(browser.navigate).toHaveBeenCalledWith('https://example.com')
  })

  it('browser_screenshot handles path logic', async () => {
    // If path is provided
    await browser_screenshot({ path: '/tmp/shot.png' })
    expect(browser.screenshot).toHaveBeenCalledWith({ path: '/tmp/shot.png', selector: undefined })

    // If path is NOT provided (default logic in index.ts)
    // We mocked Date.now? No, but it should generate a path.
    await browser_screenshot({})
    expect(browser.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining('screenshot-')
      })
    )
  })
})
