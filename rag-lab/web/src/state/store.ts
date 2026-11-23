/**
 * Tiny global store (useSyncExternalStore). Everything the UI shows — chunk
 * lists, vectors, scores, prompts, answers — lives here and comes from real
 * operations; nothing is pre-baked.
 */
import { useSyncExternalStore } from 'react'
import type { PromptEcho, SessionInfo, ChatUsage, UsageInfo, ChatMode, Lang } from '@shared/api-types'
import type { ChunkConfig, TextChunk } from '@/rag/chunker'
import type { ChunkRecord, IndexMeta, IndexedDocRecord } from '@/rag/db'

export type StageStatus = 'waiting' | 'processing' | 'completed' | 'error' | 'skipped'

export interface PlannedChunk extends TextChunk {
  id: string
  docId: string
  docTitle: string
  folder: string
  docHash: string
}

export interface EmbeddingBatch {
  index: number
  chunkIds: string[]
  status: 'pending' | 'running' | 'done' | 'failed'
  ms?: number
  tokens?: number
  error?: string
}

export type IndexStep = 'selection' | 'chunking' | 'embedding' | 'storing' | 'summary'

export interface IndexJob {
  id: string
  status: 'running' | 'done' | 'partial' | 'error' | 'cancelled'
  step: IndexStep
  startedAt: number
  config: ChunkConfig
  fullRebuild: boolean
  notes: string[]
  selection: {
    docs: { id: string; title: string; folder: string; chars: number; tokens: number; reused: boolean }[]
    totalChars: number
    totalTokens: number
  }
  chunking?: { chunks: PlannedChunk[]; ms: number; tokenizer: string }
  embedding?: {
    model: string
    dimensions: number
    total: number
    cached: number
    done: number
    batches: EmbeddingBatch[]
    sample?: { chunkId: string; values: number[] }
    tokens: number
    ms: number
    requests: number
  }
  storing?: { status: StageStatus; storedChunks: number; storedDocs: number; incompleteDocs: string[]; ms?: number }
  error?: string
}

export interface RankedChunk {
  chunkId: string
  score: number
  rank: number
}

export interface GenerationResult {
  status: StageStatus
  mode: ChatMode
  ms?: number
  prompt?: PromptEcho
  answer: string
  usage?: ChatUsage
  finishReason?: string | null
  error?: string
}

export interface QueryRun {
  id: string
  question: string
  createdAt: number
  topK: number
  threshold: number | null
  ragEnabled: boolean
  compare: boolean
  embed: { status: StageStatus; ms?: number; model?: string; dims?: number; sample?: number[]; tokens?: number; error?: string }
  vector?: Float32Array
  search: { status: StageStatus; ms?: number; ranked?: RankedChunk[]; compared?: number; error?: string }
  context: { status: StageStatus; included: string[]; belowThreshold: number }
  generate: GenerationResult
  baseline?: GenerationResult
}

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  runId: string
}


export type CenterTab = 'guide' | 'pipeline' | 'build' | 'map' | 'retrieval'
export type PipelineNodeId =
  | 'docs'
  | 'selection'
  | 'chunking'
  | 'embedModel'
  | 'vectorDb'
  | 'question'
  | 'queryEmbed'
  | 'search'
  | 'context'
  | 'llm'
  | 'answer'

export interface Settings {
  lang: Lang
  chunkSize: number
  overlap: number
  topK: number
  threshold: number | null
  showAllScores: boolean
  showRetrievalDetails: boolean
  temperature: number
  maxTokens: number
  streaming: boolean
  ragEnabled: boolean
  compareMode: boolean
  vizMode: '2d' | '3d'
  colorBy: 'folder' | 'document'
  showConnections: boolean
  showLabels: boolean
}

export interface AppState {
  auth: { status: 'locked' | 'browsing' | 'active'; session: SessionInfo | null; notice: string | null }
  usage: UsageInfo | null
  storage: { ready: boolean; persistent: boolean; bytes: number | null; error: string | null }
  index: { meta: IndexMeta | null; chunks: ChunkRecord[]; documents: Record<string, IndexedDocRecord> }
  selection: string[]
  job: IndexJob | null
  runs: Record<string, QueryRun>
  chat: ChatEntry[]
  activeRunId: string | null
  settings: Settings
  ui: {
    centerTab: CenterTab
    mobileTab: 'docs' | 'lab' | 'chat'
    pipelineNode: PipelineNodeId | null
    previewDocId: string | null
    previewHighlight: { start: number; end: number; chunkId: string } | null
    inspectChunkId: string | null
    learnTopic: string | null
    settingsOpen: boolean
    mapFocusDoc: string | null
    mapFolders: string[] | null
  }
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'pl',
  chunkSize: 400,
  overlap: 60,
  topK: 3,
  threshold: null,
  showAllScores: false,
  showRetrievalDetails: true,
  temperature: 0.2,
  maxTokens: 500,
  streaming: true,
  ragEnabled: true,
  compareMode: false,
  vizMode: '2d',
  colorBy: 'folder',
  showConnections: true,
  showLabels: false,
}

const PREFS_KEY = 'rag-lab-prefs-v1'

function loadPrefs(): { settings: Settings; selection: string[] } {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { settings: { ...DEFAULT_SETTINGS, ...p.settings }, selection: Array.isArray(p.selection) ? p.selection : [] }
    }
  } catch {
    /* storage blocked: use defaults */
  }
  return { settings: DEFAULT_SETTINGS, selection: [] }
}

const prefs = typeof window === 'undefined' ? { settings: DEFAULT_SETTINGS, selection: [] } : loadPrefs()

let state: AppState = {
  auth: { status: 'locked', session: null, notice: null },
  usage: null,
  storage: { ready: false, persistent: true, bytes: null, error: null },
  index: { meta: null, chunks: [], documents: {} },
  selection: prefs.selection,
  job: null,
  runs: {},
  chat: [],
  activeRunId: null,
  settings: prefs.settings,
  ui: {
    centerTab: 'guide',
    mobileTab: 'docs',
    pipelineNode: null,
    previewDocId: null,
    previewHighlight: null,
    inspectChunkId: null,
    learnTopic: null,
    settingsOpen: false,
    mapFocusDoc: null,
    mapFolders: null,
  },
}

const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update
  const prev = state
  state = { ...state, ...patch }
  if (prev.settings !== state.settings || prev.selection !== state.selection) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ settings: state.settings, selection: state.selection }))
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
export function updateJob(fn: (j: IndexJob) => IndexJob) {
  setState((s) => (s.job ? { job: fn(s.job) } : {}))
}
export function updateRun(id: string, fn: (r: QueryRun) => QueryRun) {
  setState((s) => (s.runs[id] ? { runs: { ...s.runs, [id]: fn(s.runs[id]) } } : {}))
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state))
}
