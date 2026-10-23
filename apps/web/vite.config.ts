import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: {
    '/auth': 'http://localhost:3000',
    '/api': { target: 'http://localhost:3000', rewrite: path => path.replace(/^\/api/, '') },
  } },
})
