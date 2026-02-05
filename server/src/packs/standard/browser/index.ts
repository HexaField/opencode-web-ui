import { browser } from './browser-lib.js'
import * as path from 'path'
import * as fs from 'fs'
// import { AppPaths } from '../../../config.js'

// Helper to ensure screenshots are saved
const ensureScreenshotPath = (userPath?: string) => {
  if (userPath) return userPath
  // Default to a timestamped file in the user's workspace or temp
  // Using AppPaths.packs is not right. Maybe a 'downloads' or 'screenshots' folder?
  // For now, let's use process.cwd() + '/screenshots'
  const screenshotDir = path.join(process.cwd(), 'screenshots')
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }
  return path.join(screenshotDir, `screenshot-${Date.now()}.png`)
}

export const browser_launch = async (args: any) => {
  await browser.launch({
    headless: args.headless,
    userAgent: args.userAgent
  })
  return 'Browser launched.'
}

export const browser_navigate = async (args: any) => {
  await browser.navigate(args.url)
  return `Navigated to ${args.url}`
}

export const browser_screenshot = async (args: any) => {
  const finalPath = ensureScreenshotPath(args.path)

  await browser.screenshot({
    path: finalPath,
    selector: args.selector
  })
  return `Screenshot saved to ${finalPath}`
}

export const browser_click = async (args: any) => {
  await browser.click(args.selector)
  return `Clicked ${args.selector}`
}

export const browser_fill = async (args: any) => {
  await browser.fill(args.selector, args.value)
  return `Filled ${args.selector} with value`
}

export const browser_extract_text = async (args: any) => {
  const text = await browser.getVisibleText(args.selector)
  return text
}

export const browser_close = async () => {
  await browser.close()
  return 'Browser closed.'
}
