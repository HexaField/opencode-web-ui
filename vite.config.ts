import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverHost = env.SERVER_HOST || '127.0.0.1'
  const serverPort = env.SERVER_PORT || '3001'
  const serverUrl = `http://${serverHost}:${serverPort}`

  return {
    plugins: [solid(), tailwindcss()],
    server: {
      host: env.CLIENT_HOST || '127.0.0.1',
      port: parseInt(env.CLIENT_PORT || '5173'),
      proxy: {
        '/fs': serverUrl,
        '/sessions': serverUrl,
        '/files': serverUrl,
        '/agents': serverUrl,
        '/git': serverUrl
      }
    },
    test: {
      exclude: ['e2e/**', 'node_modules/**']
    }
  }
})
