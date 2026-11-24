/**
 * Tiny global store (useSyncExternalStore): session, language, preferences and
 * the agent state (customer, tools, conversation, runs, confirmation, knowledge
 * base index). Changes go through `state/actions.ts`, which also persists them.
 */
import { useSyncExternalStore } from 'react'
import type { AgentMessage, SessionInfo, UsageInfo, Lang, ValidatedToolCall } from '@shared/api-types'
import { TOOL_NAMES, type ToolName } from '@shared/tools'
import type { ChatItem, RunRecord } from '@/agent/types'
import { SCENARIOS } from '@/data/scenarios'

export interface Settings {
  lang: Lang
}

export type MobileTab = 'systems' | 'workspace' | 'chat'

export interface KbIndexState {
  /** `checking`: reading the stored index; `indexing`: embedding chunks through the Worker. */
  status: 'idle' | 'checking' | 'indexing' | 'ready' | 'error'
  done: number
  total: number
  lang: Lang | null
  error: string | null
}

/** A tool call that waits for the user's decision (only `create_service_ticket`). */
export interface PendingConfirmation {
  runId: string
  call: ValidatedToolCall
}

/** The trace item shown in the details panel, e.g. `tool:<callId>` or `model:<step>`. */
export interface TraceSelection {
  runId: string
  itemId: string
}

export interface AppState {
  auth: { status: 'locked' | 'browsing' | 'active'; session: SessionInfo | null; notice: string | null }
  usage: UsageInfo | null
  settings: Settings
  ui: { mobileTab: MobileTab }
  /** False until the persisted conversation, runs and preferences are restored. */
  ready: boolean
  /** `unavailable`: this browser blocks IndexedDB (private window, blocked site data); the simulated systems cannot run. */
  storage: 'ok' | 'unavailable'
  activeCustomerId: string
  enabledTools: ToolName[]
  /** Changes on every new conversation (customer or language switch, "new conversation"). */
  conversationId: string
  conversation: ChatItem[]
  /** Model transcript of the conversation, sent (bounded) with the next message. */
  history: AgentMessage[]
  /** Id of the run in progress. */
  currentRun: string | null
  /** The last runs, oldest first (the run in progress included). */
  runs: RunRecord[]
  pendingConfirmation: PendingConfirmation | null
  kbIndex: KbIndexState
  selectedTraceItem: TraceSelection | null
}

export const DEFAULT_CUSTOMER_ID = SCENARIOS[0]!.customerId
export const DEFAULT_TOOLS: readonly ToolName[] = TOOL_NAMES
export const INITIAL_KB_INDEX: KbIndexState = { status: 'idle', done: 0, total: 0, lang: null, error: null }

export function newConversationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `conv-${Date.now()}`
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
  ui: { mobileTab: 'chat' },
  ready: false,
  storage: 'ok',
  activeCustomerId: DEFAULT_CUSTOMER_ID,
  enabledTools: [...DEFAULT_TOOLS],
  conversationId: newConversationId(),
  conversation: [],
  history: [],
  currentRun: null,
  runs: [],
  pendingConfirmation: null,
  kbIndex: INITIAL_KB_INDEX,
  selectedTraceItem: null,
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
