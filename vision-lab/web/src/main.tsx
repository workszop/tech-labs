import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { init } from './store'
import './edulab.css'
import './styles.css'

void init()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Reveal after the brand fonts load (boot gate in index.html), so the page never flashes fallback fonts.
const BRAND_FONTS = ['400 1em Outfit', '700 1em Outfit', '400 1em "IBM Plex Sans"', '600 1em "IBM Plex Sans"', '400 1em "Roboto Mono"']
void Promise.race([
  Promise.all(BRAND_FONTS.map((f) => document.fonts.load(f).catch(() => null))),
  new Promise((r) => setTimeout(r, 1500)),
]).then(() => document.documentElement.classList.add('app-ready'))

// Read-only hook for the end-to-end check (scripts/e2e.mjs) and for curious students in the console.
import { getState } from './store'
;(window as unknown as { __visionLab: unknown }).__visionLab = { getState }
