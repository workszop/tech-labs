/**
 * Chunking and indexing of the service knowledge base.
 *
 * Chunking (fixed, not configurable in this lab): each document is split at its
 * `## ` headings first; every section is then cut by the RAG Lab chunker into
 * pieces of at most 220 tokens (cl100k_base) with up to 40 tokens of overlap, and
 * every piece starts with its section heading, so a retrieved chunk always says
 * which part of the document it comes from.
 *
 * Indexing embeds `title + chunk text` through the injected `EmbedFn` in batches
 * of 32 and stores the vectors in IndexedDB keyed by language, embedding model and
 * content hash (see `db.ts`). Re-indexing unchanged content makes no embed calls.
 */
import type { Lang } from '@shared/api-types'
import { kbDocuments } from '@/data/kb'
import type { KbDocument } from '@/data/kb/types'
import { chunkText, type CountTokens } from './chunker'
import { kbDb, type KbIndexMeta } from './db'
import { getTokenCounter } from './tokenizer'

export const KB_CHUNK_SIZE = 220
export const KB_CHUNK_OVERLAP = 40
export const KB_EMBED_BATCH = 32

/**
 * Embeds texts through the Worker (`api.embed` in Task 6). The optional `model`
 * property names the embedding model the caller expects (the session's model):
 * indexing then targets that model directly, so a model change is re-indexed
 * without a probe call. Without it, indexing targets the model of the previous
 * index, and the first embed response decides.
 */
export type EmbedFn = ((texts: string[], lang: Lang) => Promise<{ model: string; embeddings: number[][] }>) & {
  readonly model?: string
}

export interface StoredChunk {
  /** `${docId}#${index}` */
  chunkId: string
  docId: string
  lang: Lang
  /** 0-based position within the document. */
  index: number
  /** Section heading without the `## ` marker. */
  section: string
  /** Chunk text, starting with its `## ` heading line. */
  text: string
  tokens: number
  /** sha256 of the embedded text (title + chunk text). */
  hash: string
}

export interface IndexInfo {
  lang: Lang
  model: string
  dimensions: number
  documents: number
  chunks: number
  /** Chunks whose vector was requested from the Worker in this run. */
  embedded: number
  /** Chunks whose vector was already stored. */
  reused: number
  indexedAt: number
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The text that is embedded for a chunk: the document title gives it the product context. */
export function embedInput(docTitle: string, chunkTextValue: string): string {
  return `${docTitle}\n\n${chunkTextValue}`
}

/** Splits a markdown body into `## ` sections. Text before the first heading becomes a section named after the document. */
export function splitSections(doc: Pick<KbDocument, 'title' | 'body'>): { heading: string; content: string }[] {
  const sections: { heading: string; content: string }[] = []
  let heading = doc.title
  let lines: string[] = []
  const flush = () => {
    const content = lines.join('\n').trim()
    if (content) sections.push({ heading, content })
  }
  for (const line of doc.body.split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      flush()
      heading = m[1]
      lines = []
    } else {
      lines.push(line)
    }
  }
  flush()
  return sections
}

/** Chunks of one document (without hashes). */
export function chunkDocument(doc: Pick<KbDocument, 'id' | 'title' | 'body'>, count: CountTokens): Omit<StoredChunk, 'hash' | 'lang'>[] {
  const out: Omit<StoredChunk, 'hash' | 'lang'>[] = []
  for (const s of splitSections(doc)) {
    const headingLine = `## ${s.heading}`
    const budget = KB_CHUNK_SIZE - count(headingLine) - 1
    for (const piece of chunkText(s.content, { chunkSize: budget, overlap: KB_CHUNK_OVERLAP }, count)) {
      const text = `${headingLine}\n\n${piece.text}`
      out.push({ chunkId: `${doc.id}#${out.length}`, docId: doc.id, index: out.length, section: s.heading, text, tokens: count(text) })
    }
  }
  return out
}

interface Corpus {
  docs: Map<string, KbDocument>
  chunks: StoredChunk[]
  /** Embedded text per chunk hash. */
  inputs: Map<string, string>
  corpusHash: string
}

const corpusCache = new Map<Lang, Promise<Corpus>>()

/** All chunks of a language, computed once per session (the documents are static). */
export function loadCorpus(lang: Lang): Promise<Corpus> {
  let p = corpusCache.get(lang)
  if (!p) {
    p = (async () => {
      const count = await getTokenCounter()
      const documents = kbDocuments(lang)
      const docs = new Map(documents.map((d) => [d.id, d]))
      const chunks: StoredChunk[] = []
      const inputs = new Map<string, string>()
      for (const d of documents) {
        for (const c of chunkDocument(d, count)) {
          const input = embedInput(d.title, c.text)
          const hash = await sha256Hex(input)
          inputs.set(hash, input)
          chunks.push({ ...c, lang, hash })
        }
      }
      const corpusHash = await sha256Hex(`${KB_CHUNK_SIZE}/${KB_CHUNK_OVERLAP}\n${chunks.map((c) => c.hash).join('\n')}`)
      return { docs, chunks, inputs, corpusHash }
    })()
    p.catch(() => corpusCache.delete(lang))
    corpusCache.set(lang, p)
  }
  return p
}

/** Chunks of one document, for the knowledge explorer. Available before indexing. */
export async function chunksOf(docId: string, lang: Lang): Promise<StoredChunk[]> {
  const { chunks } = await loadCorpus(lang)
  return chunks.filter((c) => c.docId === docId)
}

function abortError(): Error {
  return new DOMException('Indexing was cancelled.', 'AbortError')
}

async function storedHashes(lang: Lang, model: string): Promise<Set<string>> {
  const keys = await kbDb.vectors.where('[lang+model]').equals([lang, model]).primaryKeys()
  return new Set(keys.map((k) => k[2]))
}

/**
 * Builds (or completes) the index of one language. Vectors already stored for the
 * same language, model and content are reused; only missing chunks are embedded.
 * The meta row is written last, so a cancelled or failed run never looks ready.
 */
export async function indexKnowledgeBase(
  lang: Lang,
  embed: EmbedFn,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<IndexInfo> {
  if (signal?.aborted) throw abortError()
  const corpus = await loadCorpus(lang)
  const total = corpus.chunks.length
  const allHashes = [...corpus.inputs.keys()]
  const previous = await kbDb.meta.get(lang)
  let model: string | null = embed.model ?? previous?.model ?? null
  let dimensions = model && previous?.model === model ? previous.dimensions : 0
  let embedded = 0
  /** Hashes embedded in this run for the current `model`. */
  const fresh = new Set<string>()
  let pending: string[] = allHashes
  const progress = () => {
    const open = new Set(pending)
    onProgress?.(corpus.chunks.filter((c) => !open.has(c.hash)).length, total)
  }

  for (;;) {
    if (signal?.aborted) throw abortError()
    if (model) {
      const have = await storedHashes(lang, model)
      pending = pending.filter((h) => !have.has(h))
    }
    progress()
    if (pending.length === 0) break
    const batch = pending.slice(0, KB_EMBED_BATCH)
    const res = await embed(batch.map((h) => corpus.inputs.get(h)!), lang)
    if (signal?.aborted) throw abortError()
    if (!Array.isArray(res.embeddings) || res.embeddings.length !== batch.length) {
      throw new Error(`Embedding response has ${res.embeddings?.length ?? 0} vectors for ${batch.length} texts.`)
    }
    // The Worker answered with another model than expected: index everything for that model.
    const switched = model !== null && model !== res.model
    model = res.model
    if (switched) {
      dimensions = 0
      fresh.clear()
    }
    for (const v of res.embeddings) {
      if (dimensions === 0) dimensions = v.length
      if (v.length !== dimensions) throw new Error(`Embedding dimension mismatch: expected ${dimensions}, got ${v.length}.`)
    }
    await kbDb.vectors.bulkPut(batch.map((hash, i) => ({ lang, model: model!, hash, vector: Float32Array.from(res.embeddings[i]) })))
    embedded += batch.length
    batch.forEach((h) => fresh.add(h))
    pending = switched ? allHashes : pending.filter((h) => !fresh.has(h))
  }

  if (!model) throw new Error('No embedding model could be determined.')
  if (dimensions === 0) {
    const first = await kbDb.vectors.get([lang, model, allHashes[0]])
    dimensions = first?.vector.length ?? 0
  }
  // Drop vectors of this language and model that no current chunk uses any more.
  const keep = new Set(allHashes)
  const unused = (await kbDb.vectors.where('[lang+model]').equals([lang, model]).primaryKeys()).filter((k) => !keep.has(k[2]))
  if (unused.length) await kbDb.vectors.bulkDelete(unused)

  const meta: KbIndexMeta = { lang, model, dimensions, corpusHash: corpus.corpusHash, documents: corpus.docs.size, chunks: total, indexedAt: Date.now() }
  await kbDb.meta.put(meta)
  return { lang, model, dimensions, documents: meta.documents, chunks: total, embedded, reused: allHashes.length - fresh.size, indexedAt: meta.indexedAt }
}

/**
 * `ready`: an index for this language exists, was built with `embeddingModel` and
 * matches the current documents. `missing`: never indexed in this language.
 * `stale`: indexed with another model or for older documents (or incomplete).
 */
export async function indexStatus(lang: Lang, embeddingModel: string): Promise<'ready' | 'missing' | 'stale'> {
  const meta = await kbDb.meta.get(lang)
  if (!meta) return 'missing'
  if (meta.model !== embeddingModel) return 'stale'
  const corpus = await loadCorpus(lang)
  if (meta.corpusHash !== corpus.corpusHash) return 'stale'
  const have = await storedHashes(lang, embeddingModel)
  return [...corpus.inputs.keys()].every((h) => have.has(h)) ? 'ready' : 'stale'
}
