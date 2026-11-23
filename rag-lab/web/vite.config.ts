/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// GitHub Pages serves project sites from https://USER.github.io/REPO/... .
// A relative base ('./') makes every asset URL relative to index.html, so the
// same build works at /, /REPO/ or /REPO/rag-lab/. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: { port: 5173, fs: { allow: ['..'] } },
  preview: { port: 4173 },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plotly.js')) return 'plotly'
          if (id.includes('@xyflow')) return 'reactflow'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
