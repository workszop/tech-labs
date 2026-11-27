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
import { chunkLabel, findSections, labelKey, type ChunkLabelOptions } from '@/rag/chunkHeader'
import { approximateIndexBytes, openVectorStore, type ChunkRecord, type IndexMeta, type IndexedDocRecord, type VectorStore } from '@/rag/db'
import { rankBySimilarity, selectTopK, DimensionMismatchError } from '@/rag/similarity'
import { TOKENIZER_NAME } from '@/rag/tokenizer'
import { buildChatMessages } from '@shared/prompt'
import type { ContextChunk, Lang, SessionInfo } from '@shared/api-types'
import { uid } from '@/lib/utils'
import { buildTestLogCsv } from './testLog'
import { initialSelection, planBuild, type BuildPlan } from './membership'
import { getState, loadedSelectionIsMembership, markSelectionIsMembership, setSettings, setState, setUi, updateJob, updateRun, type AppState, type EmbeddingBatch, type IndexJob, type PlannedChunk, type QueryRun } from './store'
import { goTo } from './nav'

/** A document of the current-language corpus (ids are the same in every language). */
export function docById(id: string): CompanyDocument | undefined {
  return getCorpus().docById[id]
}

let store: VectorStore | null = null
let jobAbort: AbortController | null = null
let queryAbort: AbortController | null = null
/** Vectors produced during the current job, keyed by planned chunk id (kept out of React state). */
const jobVectors = new Map<string, Float32Array>()

/** Chunk label options from the current settings. */
function labelOptions(): ChunkLabelOptions {
  const st = getState().settings
  return { section: st.labelSection, meta: st.labelMeta }
}

/** The exact text that is chunked and embedded (the title is included once). */
export function docText(d: CompanyDocument) {
  return d.content.trimStart().startsWith(d.title) ? d.content : `${d.title}\n\n${d.content}`
}

/** Content hash of a document: what the index stores per document to notice a changed text or version. */
export function docHash(d: CompanyDocument): Promise<string> {
  return sha256Hex(`${d.version}\n${docText(d)}`)
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
  // A tick means membership. Prefs from before that (no marker) get the indexed documents ticked, once:
  // saving the prefs writes the marker, so afterwards the stored ticks are the truth.
  // The marker waits for a database that was really read: after a failed open (memory fallback) or
  // load the indexed documents are unknown, and marking then would leave them unticked for good.
  const { persistent, error } = getState().storage
  if (persistent && !error) markSelectionIsMembership()
  setState((s) => ({
    selection: initialSelection(s.selection, loadedSelectionIsMembership, Object.keys(s.index.documents), getCorpus().documents.map((d) => d.id)),
  }))
  await refreshDocHashes()
}

/** Content hash of every document of the current corpus (the same hash the index stores per document). */
let docHashes: Record<string, string> = {}
async function refreshDocHashes() {
  const docs = getCorpus().documents
  const list = await Promise.all(docs.map(docHash))
  docHashes = Object.fromEntries(docs.map((d, i) => [d.id, list[i]]))
  setState({}) // let views that read the build plan update
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
  await refreshDocHashes()
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

/** Do the chunk settings or the embedding model differ from the ones the index was built with? */
function spaceDiffers(s: AppState): boolean {
  const meta = s.index.meta
  if (!meta) return false
  const caps = s.auth.session?.capabilities
  const cfg = normalizeConfig({ chunkSize: s.settings.chunkSize, overlap: s.settings.overlap })
  return (
    meta.chunkSize !== cfg.chunkSize ||
    meta.overlap !== cfg.overlap ||
    (meta.labels ?? 'none') !== labelKey({ section: s.settings.labelSection, meta: s.settings.labelMeta }) ||
    (!!caps && (meta.model !== caps.embeddingModel || meta.dimensions !== caps.embeddingDimensions))
  )
}

let lastPlan: { key: unknown[]; plan: BuildPlan } | null = null
/**
 * What a build would do now: add ticked documents that are missing or changed, remove unticked ones,
 * re-split the rest when the settings changed. The result is memoised so it can be a store selector.
 */
export function currentBuildPlan(s: AppState): BuildPlan {
  const key = [s.selection, s.index, s.settings, s.auth.session, docHashes]
  if (lastPlan && lastPlan.key.every((k, i) => k === key[i])) return lastPlan.plan
  const indexed = Object.fromEntries(Object.values(s.index.documents).map((d) => [d.docId, d.docHash]))
  // Until the hashes are computed, an indexed document counts as unchanged.
  const plan = planBuild(s.selection, indexed, { ...indexed, ...docHashes }, spaceDiffers(s))
  lastPlan = { key, plan }
  return plan
}

/** Select every document of one folder (guide shortcut). */
export function selectFolder(folder: string) {
  toggleSelect(getCorpus().documents.filter((d) => d.folder === folder).map((d) => d.id), true)
}

/** Download the conversation as a CSV test log (one row per question). */
export function downloadTestLog() {
  const s = getState()
  const tx = t().lab.chat
  const seen = new Set<string>()
  const runs = s.chat.map((m) => s.runs[m.runId]).filter((r) => r && !seen.has(r.id) && seen.add(r.id))
  const csv = buildTestLogCsv(runs, s.index.chunks, tx.csv, (c) => t().lab.retrieval.chunkNo(c.chunkIndex + 1), (k) => tx.labelNames[k] ?? k)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${tx.logFileName}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  setUi({ logExported: true })
}

async function removeFromIndex(docIds: string[]) {
  if (!store) return
  await store.removeDocuments(docIds)
  await reloadIndex()
}

export async function resetKnowledgeBase() {
  jobAbort?.abort()
  if (store) await store.clear()
  jobVectors.clear()
  setState({ job: null, preview: null, runs: {}, chat: [], activeRunId: null })
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
  const labels = labelOptions()
  const meta = s.index.meta
  const spaceChanged = spaceDiffers(s)
  const plan = currentBuildPlan(s)
  // Unticked documents leave the database first; nothing else is needed when that is all that changed.
  if (plan.remove.length) {
    await removeFromIndex(plan.remove)
    if (!plan.add.length && !plan.resplit.length) {
      setState({ job: null })
      return
    }
  }
  const notes: string[] = []
  if (plan.resplit.length) notes.push(t().lab.actions.settingsChanged(plan.resplit.length))
  // The set of documents this build covers.
  const docIds = new Set([...plan.add, ...plan.resplit])
  const docs = getCorpus().documents.filter((d) => docIds.has(d.id))
  if (docs.length === 0) return

  jobAbort?.abort()
  jobAbort = new AbortController()
  const signal = jobAbort.signal
  jobVectors.clear()

  const hashes = await Promise.all(docs.map(docHash))
  const tokens = await compute.countTokens(docs.map(docText)).catch(() => docs.map((d) => Math.round(docText(d).length / 4)))
  const job: IndexJob = {
    id: uid('job'),
    status: 'running',
    step: 'selection',
    startedAt: Date.now(),
    config,
    labels,
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
  setUi({ pipelineNode: 'selection' })
  goTo('vectors')
  if (!caps) {
    updateJob((j) => ({ ...j, status: 'error', error: t().lab.actions.needCodeForEmbeddings }))
  }
  try {
    await runChunking(hashes)
  } catch (e) {
    // A failed split must not leave the job "running": the build button would stay disabled.
    updateJob((j) => ({ ...j, status: 'error', error: (e as Error).message }))
    return
  }
  if (!caps || signal.aborted) return
  await runEmbedding(signal)
}

/** Step 2: chunk in the Web Worker with the real cl100k tokenizer. */
async function runChunking(hashes?: string[]) {
  const job = getState().job
  if (!job) return
  updateJob((j) => ({ ...j, step: 'chunking' }))
  const chunking = await chunkJob(job, hashes)
  updateJob((j) => ({ ...j, chunking }))
}

/** Cut the documents of a build or a preview with its size, overlap and label; local, no API calls. */
async function chunkJob(job: IndexJob, hashes?: string[]): Promise<NonNullable<IndexJob['chunking']>> {
  const t0 = performance.now()
  const corpus = getCorpus()
  const docs = job.selection.docs.map((d) => corpus.docById[d.id])
  const result = await compute.chunk(docs.map((d) => ({ id: d.id, text: docText(d) })), job.config)
  const hashList = hashes ?? (await Promise.all(docs.map(docHash)))
  const chunks: PlannedChunk[] = []
  const words = t().lab.indexBuilder.labelWords
  result.forEach((r, i) => {
    const d = corpus.docById[r.docId]
    const sections = job.labels.section ? findSections(docText(d)) : []
    for (const c of r.chunks) {
      const label = chunkLabel(d, sections, c.start, job.labels, words)
      const text = label ? `${label}\n${c.text}` : c.text
      chunks.push({ ...c, text, labelChars: label ? label.length + 1 : 0, id: `${d.id}#${c.index}`, docId: d.id, docTitle: d.title, folder: d.folder, docHash: hashList[i] })
    }
  })
  // A label is embedded with its chunk, so it counts towards the chunk's tokens.
  const labelled = chunks.filter((c) => c.labelChars > 0)
  if (labelled.length) {
    const counts = await compute.countTokens(labelled.map((c) => c.text)).catch(() => labelled.map((c) => Math.round(c.text.length / 4)))
    labelled.forEach((c, i) => (c.tokens = counts[i]))
  }
  return { chunks, ms: performance.now() - t0, tokenizer: TOKENIZER_NAME }
}

/** Preview chunking without an access code or API calls: the given documents, or the ticked ones. */
export async function previewChunking(docIds?: string[]) {
  const s = getState()
  const ids = docIds ?? s.selection
  if (ids.length === 0) return
  const config = normalizeConfig({ chunkSize: s.settings.chunkSize, overlap: s.settings.overlap })
  const docs = getCorpus().documents.filter((d) => ids.includes(d.id))
  const tokens = await compute.countTokens(docs.map(docText)).catch(() => docs.map((d) => Math.round(docText(d).length / 4)))
  // Kept in `preview`, not `job`: a preview must not replace a failed build's error and Retry.
  const preview: IndexJob = {
    id: uid('preview'),
    status: 'cancelled',
    step: 'chunking',
    startedAt: Date.now(),
    config,
    labels: labelOptions(),
    fullRebuild: false,
    notes: [t().lab.actions.previewOnly],
    selection: {
      docs: docs.map((d, i) => ({ id: d.id, title: d.title, folder: d.folder, chars: docText(d).length, tokens: tokens[i], reused: false })),
      totalChars: docs.reduce((n, d) => n + docText(d).length, 0),
      totalTokens: tokens.reduce((a, b) => a + b, 0),
    },
  }
  setState({ preview })
  goTo('vectors')
  // A newer preview (or a reset) may have replaced this one meanwhile.
  const patch = (p: Partial<IndexJob>) => setState((s) => (s.preview?.id === preview.id ? { preview: { ...s.preview, ...p } } : {}))
  try {
    patch({ chunking: await chunkJob(preview) })
  } catch (e) {
    // Without this the preview card would wait for its fragments forever.
    patch({ status: 'error', error: (e as Error).message })
  }
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
        labelChars: c.labelChars,
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
    labels: labelKey(job.labels),
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
  } catch (e) {
    updateJob((j) => ({ ...j, status: 'error', error: (e as Error).message, storing: { status: 'error', storedChunks: 0, storedDocs: 0, incompleteDocs: incomplete } }))
  }
}

// ---------------------------------------------------------------- querying

export function cancelQuery() {
  queryAbort?.abort()
}

export interface QueryOptions {
  ragEnabled: boolean
  compare: boolean
  topK: number
  threshold: number | null
  /** true: the question and answer appear in the Case chat and become the active run. */
  toChat: boolean
  signal: AbortSignal
}

/** A question typed in the chat: replaces the previous chat question, settings come from the store. */
export async function ask(question: string) {
  const q = question.trim()
  if (!q) return
  const s = getState()
  const ragEnabled = s.settings.ragEnabled
  if (s.auth.session?.capabilities) {
    queryAbort?.abort()
    queryAbort = new AbortController()
  }
  await runQuery(q, {
    ragEnabled,
    compare: ragEnabled && s.settings.compareMode,
    topK: s.settings.topK,
    threshold: s.settings.threshold,
    toChat: true,
    // Without a session runQuery fails before using the signal; a fresh one keeps the call total.
    signal: (queryAbort ?? new AbortController()).signal,
  })
}

/**
 * Runs the whole pipeline for one question and resolves with the finished run (also stored in state.runs).
 * Never throws: failures are in the run's stage statuses. The caller owns the signal; only chat questions
 * (see `ask`) share the module-level controller that a newer chat question cancels.
 */
export async function runQuery(question: string, opts: QueryOptions): Promise<QueryRun> {
  const q = question.trim()
  const s = getState()
  const caps = s.auth.session?.capabilities
  const { ragEnabled, signal } = opts
  const docRecs = Object.values(s.index.documents)
  const run: QueryRun = {
    id: uid('run'),
    question: q,
    createdAt: Date.now(),
    index: {
      docIds: docRecs.map((d) => d.docId),
      docTitles: docRecs.map((d) => d.title),
      chunkSize: s.index.meta?.chunkSize ?? null,
      overlap: s.index.meta?.overlap ?? null,
      labels: s.index.meta?.labels ?? 'none',
      chunks: s.index.chunks.length,
    },
    topK: opts.topK,
    threshold: opts.threshold,
    ragEnabled,
    compare: ragEnabled && opts.compare,
    embed: { status: ragEnabled ? 'waiting' : 'skipped' },
    search: { status: ragEnabled ? 'waiting' : 'skipped' },
    context: { status: ragEnabled ? 'waiting' : 'skipped', included: [], belowThreshold: 0 },
    generate: { status: 'waiting', mode: ragEnabled ? 'rag' : 'no-rag', answer: '' },
    baseline: ragEnabled && opts.compare ? { status: 'waiting', mode: 'no-rag', answer: '' } : undefined,
  }
  setState((st) => ({
    runs: { ...st.runs, [run.id]: run },
    ...(opts.toChat
      ? { chat: [...st.chat, { id: uid('m'), role: 'user' as const, runId: run.id }, { id: uid('m'), role: 'assistant' as const, runId: run.id }], activeRunId: run.id }
      : {}),
  }))
  if (!caps) {
    updateRun(run.id, (r) => ({ ...r, generate: { ...r.generate, status: 'error', error: t().lab.actions.needCodeToAsk } }))
    return getState().runs[run.id] ?? run
  }
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
      return getState().runs[run.id] ?? run
    }
    const compat = indexCompatibility()
    if (!compat.ok) {
      updateRun(run.id, (r) => ({ ...r, embed: { status: 'error', error: compat.reason }, generate: { ...r.generate, status: 'error', error: compat.reason } }))
      return getState().runs[run.id] ?? run
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
      return getState().runs[run.id] ?? run
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
      return getState().runs[run.id] ?? run
    }
    const top = selectTopK(ranked, run.topK, run.threshold)
    const belowThreshold = run.threshold == null ? 0 : ranked.slice(0, run.topK).filter((r) => r.score < run.threshold!).length
    updateRun(run.id, (r) => ({
      ...r,
      search: { status: 'completed', ms: performance.now() - t1, compared: chunks.length, ranked: ranked.map((x) => ({ chunkId: x.item.id, score: x.score, rank: x.rank })) },
      context: { status: 'completed', included: top.map((t) => t.item.id), belowThreshold, docs: top.map((t) => ({ docId: t.item.docId, docTitle: t.item.docTitle, chunkIndex: t.item.chunkIndex, start: t.item.start, end: t.item.end })) },
    }))
    context = top.map((t) => ({ chunkId: t.item.id, documentTitle: t.item.docTitle, folder: folderName(t.item.folder), text: t.item.text }))
  }

  // Stage 5 — generation (and optional no-RAG baseline in parallel)
  const gens: Promise<void>[] = [generate(run.id, 'generate', ragEnabled ? 'rag' : 'no-rag', q, context, signal)]
  if (run.compare) gens.push(generate(run.id, 'baseline', 'no-rag', q, [], signal))
  await Promise.all(gens)
  void refreshUsage()
  return getState().runs[run.id] ?? run
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
  const s = getState()
  const c = s.index.chunks.find((x) => x.id === chunkId) ?? s.job?.chunking?.chunks.find((x) => x.id === chunkId) ?? s.preview?.chunking?.chunks.find((x) => x.id === chunkId)
  if (!c) return
  openDocument(c.docId, { start: c.start, end: c.end, chunkId })
}
