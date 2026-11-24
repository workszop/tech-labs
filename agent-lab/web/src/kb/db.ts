/**
 * Browser-local vector store of the service knowledge base (IndexedDB via Dexie).
 *
 * Tables
 *  - vectors: one embedding per (language, embedding model, content hash). The hash
 *             is sha256 of the exact text that was embedded, so unchanged chunks are
 *             never embedded again, and vectors of different models or languages
 *             are never mixed.
 *  - meta:    one row per language describing the finished index: the model, the
 *             dimensions and the corpus hash it was built for. A missing row means
 *             "not indexed"; a row whose model or corpus hash no longer matches
 *             means "stale".
 */
import Dexie, { type Table } from 'dexie'
import type { Lang } from '@shared/api-types'

export const KB_DB_NAME = 'agent-lab-kb'

export interface VectorRecord {
  lang: Lang
  model: string
  hash: string
  vector: Float32Array
}

export interface KbIndexMeta {
  lang: Lang
  model: string
  dimensions: number
  /** sha256 over the hashes of all chunks of the language, in order. */
  corpusHash: string
  documents: number
  chunks: number
  indexedAt: number
}

export class KbDatabase extends Dexie {
  vectors!: Table<VectorRecord, [Lang, string, string]>
  meta!: Table<KbIndexMeta, Lang>

  constructor() {
    super(KB_DB_NAME)
    this.version(1).stores({
      vectors: '[lang+model+hash], [lang+model]',
      meta: 'lang',
    })
  }
}

export const kbDb = new KbDatabase()
