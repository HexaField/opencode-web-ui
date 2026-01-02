import { defineConfig, devices } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadEnv } from 'vite'

// Setup Radicle for E2E
// Use a fixed path so all workers and webServer share the same identity
const radHome = path.join(os.tmpdir(), 'opencode-e2e-radicle-shared')
if (!fs.existsSync(radHome)) {
  fs.mkdirSync(radHome, { recursive: true })
  process.env.RAD_HOME = radHome
  process.env.RAD_PASSPHRASE = 'test'
  try {
    execSync('rad auth --alias e2e-user', { env: process.env, stdio: 'ignore' })
    console.log(`Initialized Radicle identity in ${radHome}`)
  } catch (e) {
    console.warn('Failed to init radicle identity for E2E', e)
  }
} else {
  process.env.RAD_HOME = radHome
  process.env.RAD_PASSPHRASE = 'test'
}

const env = loadEnv('', process.cwd(), '')
const PORT = env.CLIENT_PORT || '5173'
const HOST = env.CLIENT_HOST || 'localhost'
const BASE_URL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run start:test',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      RAD_HOME: radHome,
      RAD_PASSPHRASE: 'test'
    }
  }
})
