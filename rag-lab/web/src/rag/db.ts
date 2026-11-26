/**
 * Browser-local vector database (IndexedDB via Dexie).
 *
 * Tables
 *  - chunks:     one row per indexed chunk, including its embedding (Float32Array).
 *  - documents:  which documents are in the index, with the content hash they were indexed at.
 *  - meta:       the index "space": embedding model, dimensions and chunking settings.
 *                All chunks in one index share the same space — vectors from different
 *                models are never mixed.
 *  - embeddingCache: vectors keyed by sha256(model + text), so re-building with unchanged
 *                text never pays for the same embedding twice.
 *
 * If IndexedDB is unavailable (private mode in some browsers, blocked storage),
 * the same API runs against an in-memory store and the UI warns that nothing
 * will survive a reload.
 */
import Dexie, { type Table } from 'dexie'

export interface ChunkRecord {
  id: string // `${docId}#${chunkIndex}`
  docId: string
  docTitle: string
  folder: string
  chunkIndex: number
  /** `text` = label line + chunk body; this many leading characters are the label (absent in older indexes). */
  labelChars?: number
  text: string
  start: number
  end: number
  tokens: number
  overlapPrevChars: number
  overlapNextChars: number
  vector: Float32Array
  model: string
  dimensions: number
  docHash: string
  createdAt: number
}

export interface IndexedDocRecord {
  docId: string
  title: string
  folder: string
  docHash: string
  chunkCount: number
  tokens: number
  indexedAt: number
}

export interface IndexSpace {
  model: string
  dimensions: number
  chunkSize: number
  overlap: number
  tokenizer: string
  /** Chunk label options (`labelKey`); absent in indexes built before labels existed = 'none'. */
  labels?: string
}

export interface IndexMeta extends IndexSpace {
  key: 'index'
  createdAt: number
  updatedAt: number
}

export interface CacheRecord {
  key: string
  model: string
  vector: Float32Array
}

class RagDatabase extends Dexie {
  chunks!: Table<ChunkRecord, string>
  documents!: Table<IndexedDocRecord, string>
  meta!: Table<IndexMeta, string>
  embeddingCache!: Table<CacheRecord, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({
      chunks: 'id, docId, folder',
      documents: 'docId',
      meta: 'key',
      embeddingCache: 'key, model',
    })
  }
}

export interface VectorStore {
  persistent: boolean
  load(): Promise<{ meta: IndexMeta | null; chunks: ChunkRecord[]; documents: IndexedDocRecord[] }>
  replaceDocuments(meta: IndexMeta, docs: IndexedDocRecord[], chunks: ChunkRecord[], fullRebuild: boolean): Promise<void>
  removeDocuments(docIds: string[]): Promise<void>
  clear(): Promise<void>
  getCached(keys: string[]): Promise<(CacheRecord | undefined)[]>
  putCached(records: CacheRecord[]): Promise<void>
  estimateBytes(): Promise<number | null>
}

export class StorageFullError extends Error {
  constructor() {
    super('Browser storage is full. Remove some documents from the index or free up space for this site, then try again.')
    this.name = 'StorageFullError'
  }
}

function wrapQuota<T>(p: Promise<T>): Promise<T> {
  return p.catch((e: unknown) => {
    const name = (e as { name?: string; inner?: { name?: string } })?.name
    const inner = (e as { inner?: { name?: string } })?.inner?.name
    if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') throw new StorageFullError()
    throw e
  })
}

class DexieStore implements VectorStore {
  persistent = true
  constructor(private db: RagDatabase) {}
  async load() {
    const [meta, chunks, documents] = await Promise.all([this.db.meta.get('index'), this.db.chunks.toArray(), this.db.documents.toArray()])
    // IndexedDB returns typed arrays intact, but be defensive about older rows.
    for (const c of chunks) if (!(c.vector instanceof Float32Array)) c.vector = new Float32Array(c.vector as ArrayLike<number>)
    return { meta: meta ?? null, chunks, documents }
  }
  replaceDocuments(meta: IndexMeta, docs: IndexedDocRecord[], chunks: ChunkRecord[], fullRebuild: boolean) {
    return wrapQuota(
      this.db.transaction('rw', this.db.chunks, this.db.documents, this.db.meta, async () => {
        if (fullRebuild) {
          await this.db.chunks.clear()
          await this.db.documents.clear()
        } else {
          const ids = docs.map((d) => d.docId)
          await this.db.chunks.where('docId').anyOf(ids).delete()
        }
        await this.db.chunks.bulkPut(chunks)
        await this.db.documents.bulkPut(docs)
        await this.db.meta.put(meta)
      }),
    )
  }
  async removeDocuments(docIds: string[]) {
    await this.db.transaction('rw', this.db.chunks, this.db.documents, this.db.meta, async () => {
      await this.db.chunks.where('docId').anyOf(docIds).delete()
      await this.db.documents.bulkDelete(docIds)
      if ((await this.db.documents.count()) === 0) await this.db.meta.clear()
    })
  }
  async clear() {
    await Promise.all([this.db.chunks.clear(), this.db.documents.clear(), this.db.meta.clear(), this.db.embeddingCache.clear()])
  }
  getCached(keys: string[]) {
    return this.db.embeddingCache.bulkGet(keys)
  }
  putCached(records: CacheRecord[]) {
    return wrapQuota(this.db.embeddingCache.bulkPut(records).then(() => undefined))
  }
  async estimateBytes() {
    try {
      const est = await navigator.storage?.estimate?.()
      return est?.usage ?? null
    } catch {
      return null
    }
  }
}

export class MemoryStore implements VectorStore {
  persistent = false
  private meta: IndexMeta | null = null
  private chunks = new Map<string, ChunkRecord>()
  private docs = new Map<string, IndexedDocRecord>()
  private cache = new Map<string, CacheRecord>()
  async load() {
    return { meta: this.meta, chunks: [...this.chunks.values()], documents: [...this.docs.values()] }
  }
  async replaceDocuments(meta: IndexMeta, docs: IndexedDocRecord[], chunks: ChunkRecord[], fullRebuild: boolean) {
    if (fullRebuild) {
      this.chunks.clear()
      this.docs.clear()
    } else {
      const ids = new Set(docs.map((d) => d.docId))
      for (const [k, c] of this.chunks) if (ids.has(c.docId)) this.chunks.delete(k)
    }
    for (const c of chunks) this.chunks.set(c.id, c)
    for (const d of docs) this.docs.set(d.docId, d)
    this.meta = meta
  }
  async removeDocuments(docIds: string[]) {
    const ids = new Set(docIds)
    for (const [k, c] of this.chunks) if (ids.has(c.docId)) this.chunks.delete(k)
    for (const id of docIds) this.docs.delete(id)
    if (this.docs.size === 0) this.meta = null
  }
  async clear() {
    this.meta = null
    this.chunks.clear()
    this.docs.clear()
    this.cache.clear()
  }
  async getCached(keys: string[]) {
    return keys.map((k) => this.cache.get(k))
  }
  async putCached(records: CacheRecord[]) {
    for (const r of records) this.cache.set(r.key, r)
  }
  async estimateBytes() {
    return null
  }
}

export async function openVectorStore(name = 'rag-lab'): Promise<VectorStore> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB not available')
    const db = new RagDatabase(name)
    await db.open()
    return new DexieStore(db)
  } catch {
    return new MemoryStore()
  }
}

/** Approximate size of the index content (text + 4 bytes per vector dimension). */
export function approximateIndexBytes(chunks: ChunkRecord[]): number {
  return chunks.reduce((n, c) => n + c.vector.byteLength + c.text.length * 2 + 200, 0)
}
