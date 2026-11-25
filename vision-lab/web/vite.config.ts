/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A relative base ('./') makes every asset URL relative to index.html, so the same
// build works at /, /REPO/ or /REPO/vision-lab/ on GitHub Pages. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  server: { port: 5175 },
  preview: { port: 4175 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tensorflow')) return 'tfjs'
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
