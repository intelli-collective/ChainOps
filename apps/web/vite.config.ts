import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': process.env.API_URL ?? 'http://localhost:3000',
      // Module APIs (e.g. M1 pipelines) are called as /api/... and forwarded without the prefix,
      // because paths such as /projects are also frontend routes.
      '/api': { target: process.env.API_URL ?? 'http://localhost:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
})
