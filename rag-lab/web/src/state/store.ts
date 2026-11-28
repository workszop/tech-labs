/**
 * Tiny global store (useSyncExternalStore). Everything the UI shows – chunk
 * lists, vectors, scores, prompts, answers – lives here and comes from real
 * operations; nothing is pre-baked.
 */
import { useSyncExternalStore } from 'react'
import type { PromptEcho, SessionInfo, ChatUsage, UsageInfo, ChatMode, Lang } from '@shared/api-types'
import type { ChunkConfig, TextChunk } from '@/rag/chunker'
import type { ChunkLabelOptions } from '@/rag/chunkHeader'
import type { ChunkRecord, IndexMeta, IndexedDocRecord } from '@/rag/db'
import type { BenchmarkCase, CaseKind, CaseResult } from '@/rag/benchmark'

export type StageStatus = 'waiting' | 'processing' | 'completed' | 'error' | 'skipped'

export interface PlannedChunk extends TextChunk {
  /** Length of the label line (plus its newline) at the start of `text`; 0 without a label. */
  labelChars: number
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
  /** Chunk label options used by this job (see rag/chunkHeader.ts). */
  labels: ChunkLabelOptions
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
  /** The API error code behind `error` (absent when the failure was not an API error). */
  errorCode?: string
}

export interface ContextDoc {
  docId: string
  docTitle: string
  chunkIndex: number
  /** Character offsets of the fragment in its document when the run was made (ids change when the knowledge base is re-split). */
  start: number
  end: number
}

/** What the knowledge base looked like when a question was asked (for the test log). */
export interface IndexSnapshot {
  docIds: string[]
  docTitles: string[]
  chunkSize: number | null
  overlap: number | null
  labels: string
  chunks: number
}

export interface QueryRun {
  id: string
  question: string
  createdAt: number
  index?: IndexSnapshot
  topK: number
  threshold: number | null
  ragEnabled: boolean
  compare: boolean
  embed: { status: StageStatus; ms?: number; model?: string; dims?: number; sample?: number[]; tokens?: number; error?: string }
  vector?: Float32Array
  search: { status: StageStatus; ms?: number; ranked?: RankedChunk[]; compared?: number; error?: string }
  /** `docs` keeps title and number of each included chunk, so an answer stays readable after its document leaves the index. */
  context: { status: StageStatus; included: string[]; belowThreshold: number; docs?: ContextDoc[] }
  generate: GenerationResult
  baseline?: GenerationResult
}

/** One benchmark run: the settings it ran with and one result per planned case (saved after every case). */
export interface BenchmarkRun {
  id: string
  createdAt: number
  lang: Lang
  index: IndexSnapshot
  topK: number
  threshold: number | null
  /** The cases planned for this run, in order. */
  caseIds: string[]
  /** Active cases when the run started (a run of fewer is not a full run). */
  totalActive: number
  status: 'running' | 'done' | 'cancelled' | 'error'
  results: CaseResult[]
  error?: string
  /** What the export needs about each planned case, kept when the run starts (a case may be edited or deleted later). */
  caseInfo?: Record<string, BenchCaseInfo>
}

export interface BenchCaseInfo {
  kind: CaseKind
  question: string
  expectedDocTitles: string[]
}

/** Close a run: every planned case without a result gets a 'skipped' one. */
export function closeBenchRun(r: BenchmarkRun, status: 'done' | 'cancelled' | 'error', error?: string): BenchmarkRun {
  const have = new Set(r.results.map((x) => x.caseId))
  const skipped: CaseResult[] = r.caseIds
    .filter((id) => !have.has(id))
    .map((caseId) => ({ caseId, runId: r.id, status: 'skipped', retrieval: null, answer: null, answerText: '', override: null }))
  return { ...r, status, results: [...r.results, ...skipped], ...(error ? { error } : {}) }
}

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  runId: string
}


export type Part = 'case' | 'data' | 'vectors' | 'generator' | 'benchmark'
export type View = 'students' | 'tech'
export type CaseTechTab = 'retrieval' | 'pipeline' | 'guide'
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
  /** Students or Tech face of every part; only the user's click on the switch changes it. */
  view: View
  chunkSize: number
  overlap: number
  labelSection: boolean
  labelMeta: boolean
  topK: number
  threshold: number | null
  temperature: number
  maxTokens: number
  streaming: boolean
  ragEnabled: boolean
  compareMode: boolean
  vizMode: 'question' | '2d' | '3d'
  colorBy: 'folder' | 'document'
  showConnections: boolean
  showLabels: boolean
  /** Ids of benchmark cases switched off. */
  benchOff: string[]
}

export interface AppState {
  auth: { status: 'locked' | 'browsing' | 'active'; session: SessionInfo | null; notice: string | null }
  usage: UsageInfo | null
  storage: { ready: boolean; persistent: boolean; bytes: number | null; error: string | null }
  index: { meta: IndexMeta | null; chunks: ChunkRecord[]; documents: Record<string, IndexedDocRecord> }
  selection: string[]
  /** The last build (or null). */
  job: IndexJob | null
  /** The last split preview: chunking only, no embeddings, no access code. Kept apart from `job`. */
  preview: IndexJob | null
  runs: Record<string, QueryRun>
  chat: ChatEntry[]
  activeRunId: string | null
  /** Benchmark: the user's own cases (every language), runs of the current language oldest first, the running run, ticked cases. */
  bench: { customCases: BenchmarkCase[]; runs: BenchmarkRun[]; currentRunId: string | null; ticked: string[] }
  settings: Settings
  ui: {
    part: Part
    pipelineNode: PipelineNodeId | null
    previewDocId: string | null
    previewHighlight: { start: number; end: number; chunkId: string } | null
    inspectChunkId: string | null
    learnTopic: string | null
    /** The account panel (access, usage, session, logout, restore defaults) opened from the header. */
    accountOpen: boolean
    /** Tab of the Tech face of the Case part; in the store so "Full details" can select it. */
    caseTechTab: CaseTechTab
    mapFocusDoc: string | null
    mapFolders: string[] | null
    /** Folders open in the Data part, kept while the app is open so returning to Data finds them as left. */
    openFolders: string[]
    /** Guide steps that were completed at least once (they stay ticked). */
    guideDone: string[]
    benchExported: boolean
  }
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'pl',
  view: 'students',
  chunkSize: 400,
  overlap: 60,
  labelSection: false,
  labelMeta: false,
  topK: 3,
  threshold: null,
  temperature: 0.2,
  maxTokens: 500,
  streaming: true,
  ragEnabled: true,
  compareMode: false,
  vizMode: 'question',
  colorBy: 'folder',
  showConnections: true,
  showLabels: false,
  benchOff: [],
}

const PREFS_KEY = 'rag-lab-prefs-v1'

const VIEWS: View[] = ['students', 'tech']
/** Settings older versions stored that no longer exist (the retrieval-detail toggles of the removed settings dialog). */
const DROPPED_SETTINGS = ['showAllScores', 'showRetrievalDetails']

/**
 * Stored preferences. `selectionIsMembership` marks prefs written by a version where a tick means
 * "belongs to the knowledge base"; without it the ticks still need the one-time migration (see initApp).
 */
export interface StoredPrefs {
  settings: Settings
  selection: string[]
  selectionIsMembership: boolean
}

export function loadPrefsFrom(raw: string | null): StoredPrefs {
  try {
    if (raw) {
      const p = JSON.parse(raw)
      const stored = p && typeof p.settings === 'object' && p.settings ? { ...p.settings } : {}
      for (const k of DROPPED_SETTINGS) delete stored[k]
      const view: View = VIEWS.includes(stored.view) ? stored.view : DEFAULT_SETTINGS.view
      if (!Array.isArray(stored.benchOff) || !stored.benchOff.every((x: unknown) => typeof x === 'string')) delete stored.benchOff
      // The map always opens on the question-centred view; an older stored '2d' would hide it.
      return {
        settings: { ...DEFAULT_SETTINGS, ...stored, view, vizMode: DEFAULT_SETTINGS.vizMode },
        selection: Array.isArray(p?.selection) ? p.selection : [],
        selectionIsMembership: p?.selectionIsMembership === true,
      }
    }
  } catch {
    /* broken JSON: use defaults */
  }
  return { settings: DEFAULT_SETTINGS, selection: [], selectionIsMembership: false }
}

function loadPrefs(): StoredPrefs {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PREFS_KEY)
  } catch {
    /* storage blocked: use defaults */
  }
  return loadPrefsFrom(raw)
}

const prefs: StoredPrefs = typeof window === 'undefined' ? { settings: DEFAULT_SETTINGS, selection: [], selectionIsMembership: false } : loadPrefs()
/** Did the prefs found at start-up already carry the membership marker? Read once by initApp. */
export const loadedSelectionIsMembership = prefs.selectionIsMembership
/** Whether saved prefs carry the membership marker; initApp turns it on once the migration really ran. */
let selectionIsMembership = prefs.selectionIsMembership
export function markSelectionIsMembership(): void {
  selectionIsMembership = true
}

let state: AppState = {
  auth: { status: 'locked', session: null, notice: null },
  usage: null,
  storage: { ready: false, persistent: true, bytes: null, error: null },
  index: { meta: null, chunks: [], documents: {} },
  selection: prefs.selection,
  job: null,
  preview: null,
  runs: {},
  chat: [],
  activeRunId: null,
  bench: { customCases: [], runs: [], currentRunId: null, ticked: [] },
  settings: prefs.settings,
  ui: {
    part: 'case',
    pipelineNode: null,
    previewDocId: null,
    previewHighlight: null,
    inspectChunkId: null,
    learnTopic: null,
    accountOpen: false,
    caseTechTab: 'retrieval',
    mapFocusDoc: null,
    mapFolders: null,
    openFolders: [],
    guideDone: [],
    benchExported: false,
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
      localStorage.setItem(PREFS_KEY, JSON.stringify({ settings: state.settings, selection: state.selection, selectionIsMembership }))
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
