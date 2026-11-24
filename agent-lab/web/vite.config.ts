/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directory of this config file (ES module: no __dirname). */
const root = path.dirname(fileURLToPath(import.meta.url))

// GitHub Pages serves project sites from https://USER.github.io/REPO/... .
// A relative base ('./') makes every asset URL relative to index.html, so the
// same build works at /, /REPO/ or /REPO/agent-lab/. Override with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@shared': path.resolve(root, '../shared'),
    },
  },
  server: { port: 5173, fs: { allow: ['..'] } },
  preview: { port: 4173 },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      // react-compiler-runtime (pulled in by @xyflow/react) starts with a "use no memo"
      // directive the bundler cannot keep. Harmless; drop only that warning, only for node_modules.
      onwarn(warning, warn) {
        const file = warning.id ?? warning.loc?.file ?? ''
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && /(^|[\\/])node_modules[\\/]/.test(file)) return
        warn(warning)
      },
      output: {
        manualChunks(id) {
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
