import tailwindcss from '@tailwindcss/vite'
import * as fs from 'fs'
import * as path from 'path'
import { loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverHost = env.SERVER_HOST || '127.0.0.1'
  const serverPort = env.SERVER_PORT || '3001'

  const keyPath = path.join(process.cwd(), 'server/certs/server.key')
  const certPath = path.join(process.cwd(), 'server/certs/server.crt')
  const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath)

  const protocol = useHttps ? 'https' : 'http'
  const serverUrl = `${protocol}://${serverHost}:${serverPort}`

  return {
    plugins: [solid(), tailwindcss()],
    server: {
      host: env.CLIENT_HOST || '127.0.0.1',
      port: parseInt(env.CLIENT_PORT || '5173'),
      https: useHttps
        ? {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
          }
        : undefined,
      proxy: {
        '/api': {
          target: serverUrl,
          secure: false,
          ws: true
        }
      }
    },
    test: {
      globals: true,
      setupFiles: ['./server/test/setup.ts'],
      exclude: ['e2e/**', 'node_modules/**', '.opencode/**'],
      testTimeout: 60000,
      hookTimeout: 60000,
      poolOptions: {
        threads: {
          maxThreads: 1,
          minThreads: 1
        }
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: '.coverage'
      }
    }
  }
})
