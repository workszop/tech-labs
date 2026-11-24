import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initApp } from './state/actions'
import { getState } from './state/store'

document.documentElement.lang = getState().settings.lang
initApp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
