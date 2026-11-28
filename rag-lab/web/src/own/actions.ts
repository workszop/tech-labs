// Actions of the "own documents" mode: add files, split, embed through the Worker, ask with team
// instructions (profile 'own'). Reuses the chunker Web Worker, /api/embeddings and /api/chat.
import { api, ApiError } from '@/api/client'
import { compute } from '@/rag/compute'
import { normalizeConfig } from '@/rag/chunker'
import { rankBySimilarity } from '@/rag/similarity'
import { buildChatMessages, MAX_INSTRUCTIONS_CHARS } from '@shared/prompt'
import type { ContextChunk } from '@shared/api-types'
import { uid } from '@/lib/utils'
import { getLang, t } from '@/i18n'
import { getState, setState, updateOwn } from '@/state/store'
import { refreshUsage } from '@/state/actions'
import { addFiles, shortDocName } from './files'
import { askLock, fitToWorker, oversizedChunks, type OwnChunk, type OwnRun } from './state'

/** Same per-request token budget as the Rybex index build. */
const MAX_BATCH_TOKENS = 7000

let embedAbort: AbortController | null = null
let askAbort: AbortController | null = null
/** Bumped by anything that invalidates a running embedding; its late writes are then dropped. */
let embedGen = 0

/** Cancel a running embedding because the chunks it works on changed or went away. */
function cancelEmbedding() {
  embedGen++
  embedAbort?.abort()
  embedAbort = null
  if (getState().own.embed.status === 'running') updateOwn(() => ({ embed: { status: 'idle', done: 0, total: 0, tokens: 0 } }))
}

/** "Start again": stop every own-mode request so nothing writes into the fresh state or spends tokens. */
export function abortOwn() {
  embedGen++
  embedAbort?.abort()
  askAbort?.abort()
  embedAbort = null
  askAbort = null
}

/** Error text for own mode: a size error gets a hint the team can act on. */
export function ownErrorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'aborted') return t().lab.actions.stopped
    if (e.code === 'payload_too_large') return t().shell.own.errors.payloadTooLarge
    return e.message
  }
  return (e as Error).message
}
const errText = ownErrorText

let fileQueue: Promise<void> = Promise.resolve()
let queuedBatches = 0

/**
 * Files added while others are still being read wait their turn (none is dropped). Rejections add up
 * over batches queued together; a batch added when the queue is idle starts a fresh list.
 */
export function addOwnFiles(files: File[]): Promise<void> {
  if (!files.length) return fileQueue
  const fresh = queuedBatches === 0
  queuedBatches++
  fileQueue = fileQueue.then(async () => {
    updateOwn(() => ({ parsing: true }))
    try {
      const { accepted, rejected } = await addFiles(files, getState().own.docs)
      updateOwn((o) => ({ docs: [...o.docs, ...accepted], rejected: fresh ? rejected : [...o.rejected, ...rejected] }))
    } finally {
      queuedBatches--
      updateOwn(() => ({ parsing: queuedBatches > 0 }))
    }
  })
  return fileQueue
}

export function removeOwnDoc(id: string) {
  cancelEmbedding()
  updateOwn((o) => ({ docs: o.docs.filter((d) => d.id !== id), chunks: o.chunks.filter((c) => c.docId !== id) }))
}

export function setOwnChunking(chunkSize: number, overlap: number) {
  const cfg = normalizeConfig({ chunkSize, overlap })
  updateOwn(() => ({ chunkSize: cfg.chunkSize, overlap: cfg.overlap }))
}

export function setOwnInstructions(text: string) {
  updateOwn(() => ({ instructions: text.slice(0, MAX_INSTRUCTIONS_CHARS) }))
}

export function setOwnTopK(k: number) {
  updateOwn(() => ({ topK: Math.min(10, Math.max(1, Math.round(k))) }))
}

/** Split every document with the real cl100k chunker (no code needed). Drops old vectors. */
export async function splitOwn() {
  const o = getState().own
  if (!o.docs.length) return
  cancelEmbedding()
  const cfg = normalizeConfig({ chunkSize: o.chunkSize, overlap: o.overlap })
  const res = await compute.chunk(o.docs.map((d) => ({ id: d.id, text: d.text })), cfg)
  const names = Object.fromEntries(o.docs.map((d) => [d.id, d.name]))
  const chunks: OwnChunk[] = res.flatMap((r) => r.chunks.map((c) => ({ id: `${r.docId}#${c.index}`, docId: r.docId, docName: names[r.docId], index: c.index, text: c.text, tokens: c.tokens })))
  updateOwn(() => ({
    chunks,
    split: { chunkSize: cfg.chunkSize, overlap: cfg.overlap, docIds: o.docs.map((d) => d.id) },
    indexed: null,
    embed: { status: 'idle', done: 0, total: chunks.length, tokens: 0 },
  }))
}

/** Embed every chunk through the Worker in batches (needs a code). */
export async function embedOwn() {
  const s = getState()
  const caps = s.auth.session?.capabilities
  const o = s.own
  if (!caps || !o.chunks.length || o.embed.status === 'running') return
  // Asking would be locked on a Worker without profile 'own': do not spend tokens on vectors either.
  if (askLock(s.auth.status, caps) === 'worker') return
  if (oversizedChunks(o.chunks, caps.maxEmbeddingInputTokens).length) return
  embedAbort?.abort()
  embedAbort = new AbortController()
  const signal = embedAbort.signal
  const gen = ++embedGen
  const live = () => gen === embedGen
  const batches: OwnChunk[][] = []
  let cur: OwnChunk[] = []
  let curTokens = 0
  for (const c of o.chunks) {
    if (cur.length && (cur.length >= caps.maxEmbeddingBatch || curTokens + c.tokens > MAX_BATCH_TOKENS)) {
      batches.push(cur)
      cur = []
      curTokens = 0
    }
    cur.push(c)
    curTokens += c.tokens
  }
  if (cur.length) batches.push(cur)

  updateOwn(() => ({ embed: { status: 'running', done: 0, total: o.chunks.length, tokens: 0 } }))
  const vectors = new Map<string, Float32Array>()
  let tokens = 0
  try {
    for (const b of batches) {
      const res = await api.embed(b.map((c) => c.text), signal)
      if (!live()) return
      b.forEach((c, i) => vectors.set(c.id, new Float32Array(res.embeddings[i])))
      tokens += res.usage.inputTokens
      setState({ usage: res.quota })
      updateOwn((x) => ({ embed: { ...x.embed, done: vectors.size, tokens } }))
    }
  } catch (e) {
    if (live()) updateOwn((x) => ({ embed: { ...x.embed, status: 'error', error: errText(e) } }))
    return
  }
  if (!live()) return
  updateOwn((x) => ({
    chunks: x.chunks.map((c) => ({ ...c, vector: vectors.get(c.id) })),
    embed: { status: 'done', done: vectors.size, total: x.chunks.length, tokens },
    indexed: { chunkSize: o.chunkSize, overlap: o.overlap, docIds: o.docs.map((d) => d.id) },
  }))
}

export function stopOwnEmbedding() {
  embedAbort?.abort()
}

/** Ask a question over the own documents with the team instructions. */
export async function askOwn(question: string) {
  const q = question.trim()
  const s = getState()
  const caps = s.auth.session?.capabilities
  if (!q || askLock(s.auth.status, caps) || !caps) return
  const o = s.own
  const searchable = o.chunks.filter((c) => c.vector) as (OwnChunk & { vector: Float32Array })[]
  // topK shown as "sent n of k": never more than there are chunks.
  const run: OwnRun = { id: uid('own-run'), question: q, instructions: o.instructions, topK: Math.min(o.topK, searchable.length), sent: [], trimmed: 0, status: 'running', answer: '' }
  const patch = (fn: (r: OwnRun) => Partial<OwnRun>) => updateOwn((x) => ({ runs: x.runs.map((r) => (r.id === run.id ? { ...r, ...fn(r) } : r)) }))
  updateOwn((x) => ({ runs: [...x.runs, run] }))
  if (q.length > caps.maxQuestionChars) {
    patch(() => ({ status: 'error', error: t().shell.own.errors.questionTooLong(caps.maxQuestionChars) }))
    return
  }
  if (!searchable.length) {
    patch(() => ({ status: 'error', error: t().shell.own.errors.noVectors }))
    return
  }
  askAbort?.abort()
  askAbort = new AbortController()
  const signal = askAbort.signal
  try {
    const qe = await api.embed([q], signal)
    setState({ usage: qe.quota })
    const ranked = rankBySimilarity(new Float32Array(qe.embeddings[0]), searchable)
      .slice(0, o.topK)
      .map((r) => ({ chunk: r.item, score: r.score }))
    const lang = getLang()
    const folder = t().shell.own.folderLabel
    // The Worker rejects prompts over maxChatInputTokens by its own estimate; trim with that estimate.
    const toContext = (kept: typeof ranked): ContextChunk[] => kept.map((k) => ({ chunkId: k.chunk.id, documentTitle: shortDocName(k.chunk.docName), folder, text: k.chunk.text }))
    const { kept, trimmed } = fitToWorker(ranked, (kept) => buildChatMessages({ question: q, context: toContext(kept), mode: 'rag', lang, profile: 'own', instructions: o.instructions }), caps.maxChatInputTokens)
    const context = toContext(kept)
    if (!context.length) {
      patch(() => ({ status: 'error', error: t().shell.own.errors.tooLarge, trimmed }))
      return
    }
    patch(() => ({ sent: kept.map((k) => ({ chunkId: k.chunk.id, docName: k.chunk.docName, index: k.chunk.index, score: k.score, text: k.chunk.text })), trimmed }))
    const res = await api.chat(
      { question: q, context, mode: 'rag', lang, profile: 'own', instructions: o.instructions, stream: true },
      { onPrompt: (prompt) => patch(() => ({ prompt })), onDelta: (d) => patch((r) => ({ answer: r.answer + d })) },
      signal,
    )
    setState({ usage: res.quota })
    patch(() => ({ status: 'done', answer: res.answer, prompt: res.prompt }))
  } catch (e) {
    patch(() => ({ status: 'error', error: errText(e) }))
  }
  void refreshUsage()
}
