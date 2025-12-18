import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    proxy: {
      '/fs': 'http://127.0.0.1:3001',
      '/sessions': 'http://127.0.0.1:3001',
      '/files': 'http://127.0.0.1:3001',
      '/agents': 'http://127.0.0.1:3001',
    }
  }
})
