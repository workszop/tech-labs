// Pure state of the "own documents" mode. Documents, chunks and vectors live in memory only:
// a reload starts own mode from scratch (the page says so).
import type { Capabilities, ChatMessage, PromptEcho } from '@shared/api-types'
import { estimateMessagesTokens, estimateTokens } from '@shared/prompt'
import type { OwnDoc, Rejected } from './files'

export interface OwnChunk {
  id: string
  docId: string
  docName: string
  index: number
  text: string
  tokens: number
  vector?: Float32Array
}

export interface OwnSent {
  chunkId: string
  docName: string
  index: number
  score: number
  text: string
}

export interface OwnRun {
  id: string
  question: string
  instructions: string
  topK: number
  sent: OwnSent[]
  /** Retrieved chunks left out to stay under the Worker's prompt limit. */
  trimmed: number
  status: 'running' | 'done' | 'error'
  answer: string
  prompt?: PromptEcho
  error?: string
}

export interface OwnState {
  docs: OwnDoc[]
  rejected: Rejected[]
  parsing: boolean
  chunkSize: number
  overlap: number
  chunks: OwnChunk[]
  /** Chunk settings and documents of the chunks above (null until split). */
  split: { chunkSize: number; overlap: number; docIds: string[] } | null
  embed: { status: 'idle' | 'running' | 'done' | 'error'; done: number; total: number; tokens: number; error?: string }
  /** What the vectors were computed from (null until embedded). */
  indexed: { chunkSize: number; overlap: number; docIds: string[] } | null
  instructions: string
  topK: number
  runs: OwnRun[]
}

export const INITIAL_OWN: OwnState = {
  docs: [],
  rejected: [],
  parsing: false,
  chunkSize: 400,
  overlap: 60,
  chunks: [],
  split: null,
  embed: { status: 'idle', done: 0, total: 0, tokens: 0 },
  indexed: null,
  instructions: '',
  topK: 4,
  runs: [],
}

export const estimateEmbedTokens = (chunks: { tokens: number }[]): number => chunks.reduce((n, c) => n + c.tokens, 0)

const sameDocs = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i])

/** The split no longer matches the documents or the chunk settings. */
export function needsResplit(s: OwnState): boolean {
  return !s.split || s.split.chunkSize !== s.chunkSize || s.split.overlap !== s.overlap || !sameDocs(s.split.docIds, s.docs.map((d) => d.id))
}

/** The vectors no longer match the documents or the chunk settings. */
export function needsRebuild(s: OwnState): boolean {
  return !s.indexed || s.indexed.chunkSize !== s.chunkSize || s.indexed.overlap !== s.overlap || !sameDocs(s.indexed.docIds, s.docs.map((d) => d.id))
}

/**
 * Keep the best-ranked chunks whose tokens fit in `budgetTokens` next to `fixedTokens` (system prompt,
 * instructions, question). Ranking order is kept; the lowest-ranked go first.
 */
export function fitContext<T extends { chunk: { tokens: number } }>(ranked: T[], budgetTokens: number, fixedTokens: number): { kept: T[]; trimmed: number } {
  const kept: T[] = []
  let used = fixedTokens
  for (const r of ranked) {
    if (used + r.chunk.tokens > budgetTokens) break
    kept.push(r)
    used += r.chunk.tokens
  }
  return { kept, trimmed: ranked.length - kept.length }
}

/**
 * Keep the best-ranked chunks so that the prompt, measured exactly as the Worker measures it
 * (`estimateMessagesTokens`, characters / 4), stays within `budgetTokens`. Drops the lowest-ranked first.
 */
export function fitToWorker<T>(ranked: T[], build: (kept: T[]) => ChatMessage[], budgetTokens: number): { kept: T[]; trimmed: number } {
  let kept = ranked
  while (kept.length && estimateMessagesTokens(build(kept)) > budgetTokens) kept = kept.slice(0, -1)
  return { kept, trimmed: ranked.length - kept.length }
}

/** Chunks the Worker would refuse to embed: over its per-input limit by its own estimate (characters / 4). */
export function oversizedChunks<T extends { text: string; tokens: number }>(chunks: T[], maxInputTokens: number): T[] {
  return chunks.filter((c) => Math.max(c.tokens, estimateTokens(c.text)) > maxInputTokens)
}

/** Embedding cost in USD from the Worker's price per million tokens; null when the Worker does not say. */
export function embedCostUsd(tokens: number, pricePerMTok: number | undefined): number | null {
  return pricePerMTok == null ? null : (tokens / 1_000_000) * pricePerMTok
}

/** Vectors are finished and match both the current split and the current documents and settings. */
export function ownAskReady(s: OwnState): boolean {
  return s.embed.status === 'done' && !needsRebuild(s) && !needsResplit(s)
}

/** Why the Ask step is locked: no code yet, or a Worker that does not know profile 'own'. */
export function askLock(authStatus: 'locked' | 'browsing' | 'active', caps: Pick<Capabilities, 'ownProfile'> | undefined): 'code' | 'worker' | null {
  if (authStatus !== 'active' || !caps) return 'code'
  if (!caps.ownProfile) return 'worker'
  return null
}
