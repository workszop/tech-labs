/**
 * Tiny global store (useSyncExternalStore): session, language and preferences.
 * Later tasks add the agent run state here.
 */
import { useSyncExternalStore } from 'react'
import type { SessionInfo, UsageInfo, Lang } from '@shared/api-types'

export interface Settings {
  lang: Lang
}

export type MobileTab = 'systems' | 'workspace' | 'chat'

export interface AppState {
  auth: { status: 'locked' | 'browsing' | 'active'; session: SessionInfo | null; notice: string | null }
  usage: UsageInfo | null
  settings: Settings
  ui: { mobileTab: MobileTab }
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'pl',
}

/** Prefixed so that Service Agent Lab and RAG Lab never share state on one origin. */
export const PREFS_KEY = 'agent-lab-prefs-v1'

function loadPrefs(): Settings {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      const lang = p?.settings?.lang
      return { ...DEFAULT_SETTINGS, ...(lang === 'pl' || lang === 'en' ? { lang } : {}) }
    }
  } catch {
    /* storage blocked: use defaults */
  }
  return DEFAULT_SETTINGS
}

let state: AppState = {
  auth: { status: 'locked', session: null, notice: null },
  usage: null,
  settings: typeof window === 'undefined' ? DEFAULT_SETTINGS : loadPrefs(),
  ui: { mobileTab: 'workspace' },
}

const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update
  const prev = state
  state = { ...state, ...patch }
  if (prev.settings !== state.settings) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ settings: state.settings }))
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l())
}

export function setUi(patch: Partial<AppState['ui']>) {
  setState((s) => ({ ui: { ...s.ui, ...patch } }))
}
export function setSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }))
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}
