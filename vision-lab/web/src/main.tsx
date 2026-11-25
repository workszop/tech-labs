import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { init } from './store'
import './styles.css'

void init()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// Read-only hook for the end-to-end check (scripts/e2e.mjs) and for curious students in the console.
import { getState } from './store'
;(window as unknown as { __visionLab: unknown }).__visionLab = { getState }
