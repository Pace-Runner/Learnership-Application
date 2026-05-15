import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build config: React app compiled with Vite, tests run in jsdom environment
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'src/setupTests.js',
        'src/main.jsx',
        '**/*.css',
        '**/*.test.jsx',
        '**/*.acceptance.test.jsx',
        '**/*.coverage.test.jsx',
      ],
      all: true,
      include: ['src/**/*.{jsx,js}'],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
})