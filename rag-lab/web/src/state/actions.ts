/**
 * Orchestration of the two RAG pipelines:
 *   indexing:  selection → chunking → embedding (via Worker) → local vector storage
 *   querying:  question → query embedding (via Worker) → cosine search (local)
 *              → context assembly → generation (via Worker) → answer
 * Every intermediate result is written to the store so the UI can show it.
 */
import type { CompanyDocument } from '@/data/documents'
import { getCorpus } from '@/data/corpus'
import { getLang, t } from '@/i18n'
import { api, ApiError, onAuthLost } from '@/api/client'
import { compute } from '@/rag/compute'
import { sha256Hex } from '@/rag/hash'
import { normalizeConfig } from '@/rag/chunker'
import { approximateIndexBytes, openVectorStore, type ChunkRecord, type IndexMeta, type IndexedDocRecord, type VectorStore } from '@/rag/db'
import { rankBySimilarity, selectTopK, DimensionMismatchError } from '@/rag/similarity'
import { TOKENIZER_NAME } from '@/rag/tokenizer'
import { buildChatMessages } from '@shared/prompt'
import type { ContextChunk, Lang, SessionInfo } from '@shared/api-types'
import { uid } from '@/lib/utils'
import { getState, setSettings, setState, setUi, updateJob, updateRun, type EmbeddingBatch, type IndexJob, type PlannedChunk, type QueryRun } from './store'

/** A document of the current-language corpus (ids are the same in every language). */
export function docById(id: string): CompanyDocument | undefined {
  return getCorpus().docById[id]
}

let store: VectorStore | null = null
let jobAbort: AbortController | null = null
let queryAbort: AbortController | null = null
/** Vectors produced during the current job, keyed by planned chunk id (kept out of React state). */
const jobVectors = new Map<string, Float32Array>()

/** The exact text that is chunked and embedded (the title is included once). */
export function docText(d: CompanyDocument) {
  return d.content.trimStart().startsWith(d.title) ? d.content : `${d.title}\n\n${d.content}`
}

// ---------------------------------------------------------------- boot / auth

export async function initApp() {
  onAuthLost((err) => {
    setState((s) => ({
      auth: { status: 'locked', session: null, notice: err.code === 'session_expired' ? t().lab.actions.sessionExpired : err.message },
      usage: s.usage,
    }))
  })
  store = await openVectorStore()
  await reloadIndex()
  // An index built from the other language version of the documents cannot be mixed with this one.
  if (getState().index.chunks.length > 0 && readIndexLang() !== getState().settings.lang) await resetKnowledgeBase()
  writeIndexLang(getState().settings.lang)
}

// ---------------------------------------------------------------- language

const INDEX_LANG_KEY = 'rag-lab-index-lang'
function readIndexLang(): Lang {
  try {
    const v = localStorage.getItem(INDEX_LANG_KEY)
    if (v === 'pl' || v === 'en') return v
  } catch {
    /* storage blocked */
  }
  return 'en' // indexes created before the Polish version existed are English
}
function writeIndexLang(lang: Lang) {
  try {
    localStorage.setItem(INDEX_LANG_KEY, lang)
  } catch {
    /* storage blocked */
  }
}

/** True when switching the language would throw away an index or a conversation. */
export function langSwitchLosesWork(): boolean {
  const s = getState()
  return s.index.chunks.length > 0 || s.chat.length > 0 || s.job !== null
}

/** Switch UI + document language. The knowledge base is cleared: it was built from the other version. */
export async function setLang(lang: Lang) {
  if (getState().settings.lang === lang) return
  await resetKnowledgeBase()
  setSettings({ lang })
  writeIndexLang(lang)
  document.documentElement.lang = lang
}

async function reloadIndex() {
  if (!store) return
  try {
    const { meta, chunks, documents } = await store.load()
    const bytes = await store.estimateBytes()
    setState({
      index: { meta, chunks, documents: Object.fromEntries(documents.map((d) => [d.docId, d])) },
      storage: { ready: true, persistent: store.persistent, bytes: bytes ?? approximateIndexBytes(chunks), error: null },
    })
  } catch (e) {
    setState({ storage: { ready: true, persistent: false, bytes: null, error: (e as Error).message } })
  }
}

export async function activate(code: string): Promise<SessionInfo> {
  const session = await api.activate(code)
  setState({ auth: { status: 'active', session, notice: null }, usage: session.usage })
  return session
}

export function browseWithoutActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'browsing', notice: null } }))
}

export function showActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'locked' } }))
}

export async function logout() {
  await api.logout().catch(() => undefined)
  setState({ auth: { status: 'locked', session: null, notice: t().lab.actions.loggedOut } })
}

export async function refreshUsage() {
  try {
    const usage = await api.usage()
    setState({ usage })
  } catch {
    /* auth errors are handled by onAuthLost */
  }
}

/** Is the current index compatible with the model the server offers right now? */
export function indexCompatibility(): { ok: boolean; reason?: string } {
  const { index, auth } = getState()
  const caps = auth.session?.capabilities
  if (!index.meta || !caps) return { ok: true }
  if (index.meta.model !== caps.embeddingModel)
    return { ok: false, reason: t().lab.actions.modelChanged(index.meta.model, caps.embeddingModel) }
  if (index.meta.dimensions !== caps.embeddingDimensions)
    return { ok: false, reason: t().lab.actions.dimensionsChanged(index.meta.dimensions, caps.embeddingDimensions) }
  return { ok: true }
}

// ---------------------------------------------------------------- selection

export function toggleSelect(ids: string[], on: boolean) {
  setState((s) => {
    const set = new Set(s.selection)
    ids.forEach((id) => (on ? set.add(id) : set.delete(id)))
    return { selection: getCorpus().documents.map((d) => d.id).filter((id) => set.has(id)) }
  })
}

export async function removeFromIndex(docIds: string[]) {
  if (!store) return
  await store.removeDocuments(docIds)
  await reloadIndex()
}

export async function resetKnowledgeBase() {
  jobAbort?.abort()
  if (store) await store.clear()
  jobVectors.clear()
  setState({ job: null, runs: {}, chat: [], activeRunId: null })
  await reloadIndex()
}

// ---------------------------------------------------------------- indexing

export function cancelIndexing() {
  jobAbort?.abort()
}

export async function buildIndex() {
  const s = getState()
  const caps = s.auth.session?.capabilities
  const config = normalizeConfig({ chunkSize: s.settings.chunkSize, overlap: s.settings.overlap })
  const meta = s.index.meta
  const spaceChanged =
    !!meta && (meta.chunkSize !== config.chunkSize || meta.overlap !== config.overlap || (caps && (meta.model !== caps.embeddingModel || meta.dimensions !== caps.embeddingDimensions)))
  const notes: string[] = []
  // The set of documents this build covers.
  let docIds = [...s.selection]
  if (spaceChanged) {
    const already = Object.keys(s.index.documents)
    if (already.length) notes.push(t().lab.actions.settingsChanged(already.length))
    docIds = [...new Set([...already, ...docIds])]
  }
  const docs = getCorpus().documents.filter((d) => docIds.includes(d.id))
  if (docs.length === 0) return

  jobAbort?.abort()
  jobAbort = new AbortController()
  const signal = jobAbort.signal
  jobVectors.clear()

  const hashes = await Promise.all(docs.map((d) => sha256Hex(`${d.version}\n${docText(d)}`)))
  const tokens = await compute.countTokens(docs.map(docText)).catch(() => docs.map((d) => Math.round(docText(d).length / 4)))
  const job: IndexJob = {
    id: uid('job'),
    status: 'running',
    step: 'selection',
    startedAt: Date.now(),
    config,
    fullRebuild: !!spaceChanged || !meta,
    notes,
    selection: {
      docs: docs.map((d, i) => ({
        id: d.id,
        title: d.title,
        folder: d.folder,
        chars: docText(d).length,
        tokens: tokens[i],
        reused: !spaceChanged && s.index.documents[d.id]?.docHash === hashes[i],
      })),
      totalChars: docs.reduce((n, d) => n + docText(d).length, 0),
      totalTokens: tokens.reduce((a, b) => a + b, 0),
    },
  }
  setState({ job })
  setUi({ centerTab: 'build', pipelineNode: 'selection' })
  if (!caps) {
    updateJob((j) => ({ ...j, status: 'error', error: t().lab.actions.needCodeForEmbeddings }))
  }
  await runChunking(hashes)
  if (!caps || signal.aborted) return
  await runEmbedding(signal)
}

/** Step 2: chunk in the Web Worker with the real cl100k tokenizer. */
async function runChunking(hashes?: string[]) {
  const job = getState().job
  if (!job) return
  updateJob((j) => ({ ...j, step: 'chunking' }))
  const t0 = performance.now()
  const corpus = getCorpus()
  const docs = job.selection.docs.map((d) => corpus.docById[d.id])
  const result = await compute.chunk(docs.map((d) => ({ id: d.id, text: docText(d) })), job.config)
  const hashList = hashes ?? (await Promise.all(docs.map((d) => sha256Hex(`${d.version}\n${docText(d)}`))))
  const chunks: PlannedChunk[] = []
  result.forEach((r, i) => {
    const d = corpus.docById[r.docId]
    for (const c of r.chunks) chunks.push({ ...c, id: `${d.id}#${c.index}`, docId: d.id, docTitle: d.title, folder: d.folder, docHash: hashList[i] })
  })
  updateJob((j) => ({ ...j, chunking: { chunks, ms: performance.now() - t0, tokenizer: TOKENIZER_NAME } }))
}

/** Preview chunking for the current selection without an access code or API calls. */
export async function previewChunking() {
  const s = getState()
  if (s.selection.length === 0) return
  const config = normalizeConfig({ chunkSize: s.settings.chunkSize, overlap: s.settings.overlap })
  const docs = getCorpus().documents.filter((d) => s.selection.includes(d.id))
  const tokens = await compute.countTokens(docs.map(docText))
  setState({
    job: {
      id: uid('job'),
      status: 'cancelled',
      step: 'chunking',
      startedAt: Date.now(),
      config,
      fullRebuild: false,
      notes: [t().lab.actions.previewOnly],
      selection: {
        docs: docs.map((d, i) => ({ id: d.id, title: d.title, folder: d.folder, chars: docText(d).length, tokens: tokens[i], reused: false })),
        totalChars: docs.reduce((n, d) => n + docText(d).length, 0),
        totalTokens: tokens.reduce((a, b) => a + b, 0),
      },
    },
  })
  setUi({ centerTab: 'build' })
  await runChunking()
}

const MAX_BATCH_TOKENS = 7000

/** Step 3: embed through the Worker, in batches; cached vectors are reused. */
async function runEmbedding(signal: AbortSignal) {
  const s = getState()
  const job = s.job
  const caps = s.auth.session?.capabilities
  if (!job?.chunking || !caps || !store) return
  const model = caps.embeddingModel
  const chunks = job.chunking.chunks
  updateJob((j) => ({ ...j, step: 'embedding' }))

  // 1) cache lookup — identical text + model ⇒ identical vector, no need to pay twice
  const keys = await Promise.all(chunks.map((c) => sha256Hex(`${model}\n${c.text}`)))
  const cached = await store.getCached(keys)
  let cachedCount = 0
  cached.forEach((rec, i) => {
    if (rec && rec.vector.length === caps.embeddingDimensions) {
      jobVectors.set(chunks[i].id, rec.vector)
      cachedCount++
    }
  })
  const todo = chunks.filter((c) => !jobVectors.has(c.id))
  const batches: EmbeddingBatch[] = []
  let cur: string[] = []
  let curTokens = 0
  for (const c of todo) {
    if (cur.length && (cur.length >= caps.maxEmbeddingBatch || curTokens + c.tokens > MAX_BATCH_TOKENS)) {
      batches.push({ index: batches.length, chunkIds: cur, status: 'pending' })
      cur = []
      curTokens = 0
    }
    cur.push(c.id)
    curTokens += c.tokens
  }
  if (cur.length) batches.push({ index: batches.length, chunkIds: cur, status: 'pending' })
  const firstSample = jobVectors.size ? [...jobVectors.entries()][0] : null
  updateJob((j) => ({
    ...j,
    embedding: {
      model,
      dimensions: caps.embeddingDimensions,
      total: chunks.length,
      cached: cachedCount,
      done: cachedCount,
      batches,
      tokens: 0,
      ms: 0,
      requests: 0,
      sample: firstSample ? { chunkId: firstSample[0], values: Array.from(firstSample[1].slice(0, 12)) } : undefined,
    },
  }))
  await processBatches(signal, keys)
}

async function processBatches(signal: AbortSignal, keys?: string[]) {
  const s = getState()
  const job = s.job
  const caps = s.auth.session?.capabilities
  if (!job?.embedding || !job.chunking || !caps || !store) return
  const byId = new Map(job.chunking.chunks.map((c) => [c.id, c]))
  const model = job.embedding.model
  let fatal: ApiError | null = null
  for (const batch of job.embedding.batches) {
    if (batch.status === 'done') continue
    if (signal.aborted) break
    setBatch(batch.index, { status: 'running', error: undefined })
    const texts = batch.chunkIds.map((id) => byId.get(id)!.text)
    const t0 = performance.now()
    try {
      const res = await api.embed(texts, signal)
      if (res.model !== model || res.dimensions !== caps.embeddingDimensions) throw new ApiError('upstream_bad_response', t().lab.actions.unexpectedModel(model, caps.embeddingDimensions, res.model, res.dimensions))
      const cacheRecs = await Promise.all(
        batch.chunkIds.map(async (id, i) => {
          const v = new Float32Array(res.embeddings[i])
          jobVectors.set(id, v)
          return { key: keys?.[job.chunking!.chunks.findIndex((c) => c.id === id)] ?? (await sha256Hex(`${model}\n${byId.get(id)!.text}`)), model, vector: v }
        }),
      )
      await store.putCached(cacheRecs).catch(() => undefined)
      const ms = performance.now() - t0
      setState({ usage: res.quota })
      updateJob((j) => ({
        ...j,
        embedding: {
          ...j.embedding!,
          done: j.embedding!.done + batch.chunkIds.length,
          tokens: j.embedding!.tokens + res.usage.inputTokens,
          ms: j.embedding!.ms + ms,
          requests: j.embedding!.requests + 1,
          sample: j.embedding!.sample ?? { chunkId: batch.chunkIds[0], values: res.embeddings[0].slice(0, 12) },
          batches: j.embedding!.batches.map((b) => (b.index === batch.index ? { ...b, status: 'done', ms, tokens: res.usage.inputTokens } : b)),
        },
      }))
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('internal', (e as Error).message)
      if (err.code === 'aborted') {
        setBatch(batch.index, { status: 'pending' })
        break
      }
      setBatch(batch.index, { status: 'failed', error: err.message, ms: performance.now() - t0 })
      if (err.isAuthError || err.code === 'quota_exceeded' || err.code === 'rate_limited' || err.code === 'network') {
        fatal = err
        break
      }
    }
  }
  if (signal.aborted) {
    updateJob((j) => ({ ...j, status: 'cancelled', notes: [...j.notes, t().lab.actions.indexingCancelled] }))
    return
  }
  const failed = getState().job?.embedding?.batches.filter((b) => b.status !== 'done') ?? []
  await runStoring()
  if (failed.length) {
    updateJob((j) => ({
      ...j,
      status: 'partial',
      error: fatal ? fatal.message : t().lab.actions.batchesFailed(failed.length),
    }))
  }
}

function setBatch(index: number, patch: Partial<EmbeddingBatch>) {
  updateJob((j) => ({ ...j, embedding: { ...j.embedding!, batches: j.embedding!.batches.map((b) => (b.index === index ? { ...b, ...patch } : b)) } }))
}

export async function retryFailedBatches() {
  jobAbort = new AbortController()
  updateJob((j) => ({ ...j, status: 'running', error: undefined, step: 'embedding' }))
  await processBatches(jobAbort.signal)
}

/** Step 4: write complete documents (all chunks embedded) to IndexedDB. */
async function runStoring() {
  const s = getState()
  const job = s.job
  if (!job?.chunking || !job.embedding || !store) return
  updateJob((j) => ({ ...j, step: 'storing', storing: { status: 'processing', storedChunks: 0, storedDocs: 0, incompleteDocs: [] } }))
  const t0 = performance.now()
  const now = Date.now()
  const byDoc = new Map<string, PlannedChunk[]>()
  for (const c of job.chunking.chunks) byDoc.set(c.docId, [...(byDoc.get(c.docId) ?? []), c])
  const records: ChunkRecord[] = []
  const docs: IndexedDocRecord[] = []
  const incomplete: string[] = []
  for (const [docId, chunks] of byDoc) {
    if (!chunks.every((c) => jobVectors.has(c.id))) {
      incomplete.push(docId)
      continue
    }
    for (const c of chunks) {
      records.push({
        id: c.id,
        docId,
        docTitle: c.docTitle,
        folder: c.folder,
        chunkIndex: c.index,
        text: c.text,
        start: c.start,
        end: c.end,
        tokens: c.tokens,
        overlapPrevChars: c.overlapPrevChars,
        overlapNextChars: c.overlapNextChars,
        vector: jobVectors.get(c.id)!,
        model: job.embedding.model,
        dimensions: job.embedding.dimensions,
        docHash: c.docHash,
        createdAt: now,
      })
    }
    docs.push({ docId, title: chunks[0].docTitle, folder: chunks[0].folder, docHash: chunks[0].docHash, chunkCount: chunks.length, tokens: chunks.reduce((n, c) => n + c.tokens, 0), indexedAt: now })
  }
  const prevMeta = s.index.meta
  const meta: IndexMeta = {
    key: 'index',
    model: job.embedding.model,
    dimensions: job.embedding.dimensions,
    chunkSize: job.config.chunkSize,
    overlap: job.config.overlap,
    tokenizer: TOKENIZER_NAME,
    createdAt: job.fullRebuild || !prevMeta ? now : prevMeta.createdAt,
    updatedAt: now,
  }
  try {
    if (docs.length) await store.replaceDocuments(meta, docs, records, job.fullRebuild)
    await reloadIndex()
    updateJob((j) => ({
      ...j,
      step: 'summary',
      status: incomplete.length ? 'partial' : 'done',
      storing: { status: 'completed', storedChunks: records.length, storedDocs: docs.length, incompleteDocs: incomplete, ms: performance.now() - t0 },
    }))
    // Indexed documents leave the "selected" list: selection and indexing are separate.
    if (docs.length) setState((st) => ({ selection: st.selection.filter((id) => !docs.some((d) => d.docId === id)) }))
  } catch (e) {
    updateJob((j) => ({ ...j, status: 'error', error: (e as Error).message, storing: { status: 'error', storedChunks: 0, storedDocs: 0, incompleteDocs: incomplete } }))
  }
}

// ---------------------------------------------------------------- querying

export function cancelQuery() {
  queryAbort?.abort()
}

export async function ask(question: string) {
  const q = question.trim()
  if (!q) return
  const s = getState()
  const caps = s.auth.session?.capabilities
  const ragEnabled = s.settings.ragEnabled
  const run: QueryRun = {
    id: uid('run'),
    question: q,
    createdAt: Date.now(),
    topK: s.settings.topK,
    threshold: s.settings.threshold,
    ragEnabled,
    compare: ragEnabled && s.settings.compareMode,
    embed: { status: ragEnabled ? 'waiting' : 'skipped' },
    search: { status: ragEnabled ? 'waiting' : 'skipped' },
    context: { status: ragEnabled ? 'waiting' : 'skipped', included: [], belowThreshold: 0 },
    generate: { status: 'waiting', mode: ragEnabled ? 'rag' : 'no-rag', answer: '' },
    baseline: ragEnabled && s.settings.compareMode ? { status: 'waiting', mode: 'no-rag', answer: '' } : undefined,
  }
  setState((st) => ({
    runs: { ...st.runs, [run.id]: run },
    chat: [...st.chat, { id: uid('m'), role: 'user', runId: run.id }, { id: uid('m'), role: 'assistant', runId: run.id }],
    activeRunId: run.id,
  }))
  if (!caps) {
    updateRun(run.id, (r) => ({ ...r, generate: { ...r.generate, status: 'error', error: t().lab.actions.needCodeToAsk } }))
    return
  }
  queryAbort?.abort()
  queryAbort = new AbortController()
  const signal = queryAbort.signal

  let context: ContextChunk[] = []
  if (ragEnabled) {
    const chunks = getState().index.chunks
    if (chunks.length === 0) {
      updateRun(run.id, (r) => ({
        ...r,
        embed: { status: 'skipped' },
        search: { status: 'error', error: t().lab.actions.emptyKnowledgeBase },
        generate: { ...r.generate, status: 'error', error: t().lab.actions.emptyKnowledgeBaseLong },
      }))
      return
    }
    const compat = indexCompatibility()
    if (!compat.ok) {
      updateRun(run.id, (r) => ({ ...r, embed: { status: 'error', error: compat.reason }, generate: { ...r.generate, status: 'error', error: compat.reason } }))
      return
    }
    // Stage 2 — query embedding
    updateRun(run.id, (r) => ({ ...r, embed: { status: 'processing' } }))
    const t0 = performance.now()
    let qv: Float32Array
    try {
      const res = await api.embed([q], signal)
      qv = new Float32Array(res.embeddings[0])
      setState({ usage: res.quota })
      updateRun(run.id, (r) => ({
        ...r,
        vector: qv,
        embed: { status: 'completed', ms: performance.now() - t0, model: res.model, dims: res.dimensions, sample: res.embeddings[0].slice(0, 12), tokens: res.usage.inputTokens },
      }))
    } catch (e) {
      failRun(run.id, 'embed', e)
      return
    }
    // Stage 3 — similarity search (exact cosine over the original vectors)
    updateRun(run.id, (r) => ({ ...r, search: { status: 'processing' } }))
    const t1 = performance.now()
    let ranked
    try {
      ranked = rankBySimilarity(qv, chunks)
    } catch (e) {
      const msg = e instanceof DimensionMismatchError ? t().lab.actions.dimensionMismatch(e.message, e.expected, e.actual) : (e as Error).message
      updateRun(run.id, (r) => ({ ...r, search: { status: 'error', error: msg }, generate: { ...r.generate, status: 'error', error: msg } }))
      return
    }
    const top = selectTopK(ranked, run.topK, run.threshold)
    const belowThreshold = run.threshold == null ? 0 : ranked.slice(0, run.topK).filter((r) => r.score < run.threshold!).length
    updateRun(run.id, (r) => ({
      ...r,
      search: { status: 'completed', ms: performance.now() - t1, compared: chunks.length, ranked: ranked.map((x) => ({ chunkId: x.item.id, score: x.score, rank: x.rank })) },
      context: { status: 'completed', included: top.map((t) => t.item.id), belowThreshold },
    }))
    context = top.map((t) => ({ chunkId: t.item.id, documentTitle: t.item.docTitle, folder: folderName(t.item.folder), text: t.item.text }))
  }

  // Stage 5 — generation (and optional no-RAG baseline in parallel)
  const gens: Promise<void>[] = [generate(run.id, 'generate', ragEnabled ? 'rag' : 'no-rag', q, context, signal)]
  if (run.compare) gens.push(generate(run.id, 'baseline', 'no-rag', q, [], signal))
  await Promise.all(gens)
  void refreshUsage()
}

async function generate(runId: string, slot: 'generate' | 'baseline', mode: 'rag' | 'no-rag', question: string, context: ContextChunk[], signal: AbortSignal) {
  const s = getState()
  const t0 = performance.now()
  const patch = (fn: (g: NonNullable<QueryRun['generate']>) => NonNullable<QueryRun['generate']>) => updateRun(runId, (r) => ({ ...r, [slot]: fn(r[slot]!) }))
  patch((g) => ({ ...g, status: 'processing' }))
  try {
    const res = await api.chat(
      { lang: getLang(), question, context, mode, temperature: s.settings.temperature, maxTokens: s.settings.maxTokens, stream: s.settings.streaming },
      {
        onPrompt: (prompt) => patch((g) => ({ ...g, prompt })),
        onDelta: (text) => patch((g) => ({ ...g, answer: g.answer + text })),
      },
      signal,
    )
    setState({ usage: res.quota })
    patch((g) => ({ ...g, status: 'completed', answer: res.answer, prompt: res.prompt, usage: res.usage, finishReason: res.finishReason, ms: performance.now() - t0 }))
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('internal', (e as Error).message)
    patch((g) => ({ ...g, status: 'error', error: err.code === 'aborted' ? t().lab.actions.stopped : err.message, ms: performance.now() - t0 }))
  }
}

function failRun(runId: string, stage: 'embed', e: unknown) {
  const err = e instanceof ApiError ? e : new ApiError('internal', (e as Error).message)
  const msg = err.code === 'aborted' ? t().lab.actions.stopped : err.message
  updateRun(runId, (r) => ({ ...r, [stage]: { ...r[stage], status: 'error', error: msg }, generate: { ...r.generate, status: 'error', error: msg } }))
}

export function clearConversation() {
  queryAbort?.abort()
  setState({ chat: [], runs: {}, activeRunId: null })
}

/** Preview the exact messages the Worker will build (same shared template). */
export function previewMessages(question: string, contextIds: string[]) {
  const chunks = getState().index.chunks
  const ctx = contextIds
    .map((id) => chunks.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => ({ chunkId: c!.id, documentTitle: c!.docTitle, folder: folderName(c!.folder), text: c!.text }))
  return buildChatMessages({ question, context: ctx, mode: 'rag', lang: getLang() })
}

// ---------------------------------------------------------------- navigation helpers

/** Folder name in the current language. */
export function folderName(id: string) {
  return getCorpus().folders.find((f) => f.id === id)?.name ?? id
}

export function openDocument(docId: string, highlight?: { start: number; end: number; chunkId: string }) {
  setUi({ previewDocId: docId, previewHighlight: highlight ?? null })
}

export function openChunkInDocument(chunkId: string) {
  const c = getState().index.chunks.find((x) => x.id === chunkId) ?? getState().job?.chunking?.chunks.find((x) => x.id === chunkId)
  if (!c) return
  openDocument(c.docId, { start: c.start, end: c.end, chunkId })
}
