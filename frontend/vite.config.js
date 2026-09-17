import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.MGAI_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
  },
})
