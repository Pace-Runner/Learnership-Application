import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build config: React app compiled with Vite, tests run in jsdom environment
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
  },
})