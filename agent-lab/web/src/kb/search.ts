/**
 * Semantic search over the indexed service knowledge base, used by the agent's
 * `search_service_knowledge` tool.
 *
 * The query text is `query`, plus the product model and error code when given,
 * embedded as one string. Every chunk of the language is scored by exact cosine
 * similarity. A product model only filters (documents that apply to all products
 * or to that model); there is no lookup table from error codes to answers, so
 * what the agent gets is exactly what retrieval finds. Superseded documents stay
 * searchable and are returned flagged, so the agent has to notice the newer one.
 */
import type { Lang } from '@shared/api-types'
import type { KnowledgeHit } from '@/data/kb/types'
import { kbDb } from './db'
import { loadCorpus, type EmbedFn } from './indexer'
import { rankBySimilarity, selectTopK } from './similarity'

export type { KnowledgeHit }
export type { EmbedFn, IndexInfo, StoredChunk } from './indexer'
export { chunksOf, indexKnowledgeBase, indexStatus } from './indexer'

export const KB_DEFAULT_K = 5

/**
 * The index for the language is missing or stale (other embedding model, older
 * documents). Carries `code: 'index_not_ready'`, which the tool layer passes
 * through as the error code of the tool result.
 */
export class KbNotReadyError extends Error {
  readonly code = 'index_not_ready' as const
  constructor(
    public readonly reason: 'missing' | 'stale',
    public readonly lang: Lang,
  ) {
    super(
      reason === 'missing'
        ? `The service knowledge base has not been indexed for language "${lang}" yet. Index it in the Knowledge system, then search again.`
        : `The service knowledge base index for language "${lang}" is out of date (built with another embedding model or for older documents). Re-index it, then search again.`,
    )
    this.name = 'KbNotReadyError'
  }
}

/** Lowercase, single spaces, without the brand prefix: "Northstar PureAir 300" and "pureair 300" match. */
export function normalizeModel(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^northstar /, '')
}

export async function searchKnowledge(
  q: { query: string; productModel?: string; errorCode?: string },
  opts: { lang: Lang; embed: EmbedFn; k?: number },
): Promise<KnowledgeHit[]> {
  const { lang, embed } = opts
  const meta = await kbDb.meta.get(lang)
  if (!meta) throw new KbNotReadyError('missing', lang)
  const corpus = await loadCorpus(lang)
  if (meta.corpusHash !== corpus.corpusHash) throw new KbNotReadyError('stale', lang)
  if (embed.model && embed.model !== meta.model) throw new KbNotReadyError('stale', lang)

  const text = [q.query, q.productModel, q.errorCode].map((s) => s?.trim()).filter(Boolean).join(' ')
  const res = await embed([text], lang)
  const queryVector = res.embeddings[0]
  if (res.model !== meta.model || !queryVector || queryVector.length !== meta.dimensions) throw new KbNotReadyError('stale', lang)

  const stored = await kbDb.vectors.bulkGet(corpus.chunks.map((c) => [lang, meta.model, c.hash] as [Lang, string, string]))
  if (stored.some((v) => !v)) throw new KbNotReadyError('stale', lang)

  const model = q.productModel?.trim() ? normalizeModel(q.productModel) : null
  const items = corpus.chunks
    .map((chunk, i) => ({ id: chunk.chunkId, chunk, vector: stored[i]!.vector }))
    .filter(({ chunk }) => {
      if (!model) return true
      const applies = corpus.docs.get(chunk.docId)!.appliesTo
      return applies.length === 0 || applies.some((m) => normalizeModel(m) === model)
    })

  return selectTopK(rankBySimilarity(queryVector, items), opts.k ?? KB_DEFAULT_K).map(({ item: { chunk }, score }) => {
    const doc = corpus.docs.get(chunk.docId)!
    return {
      chunkId: chunk.chunkId,
      docId: doc.id,
      docTitle: doc.title,
      section: chunk.section,
      text: chunk.text,
      score: Math.round(score * 1e4) / 1e4,
      authority: doc.authority,
      status: doc.status,
      ...(doc.supersededBy ? { supersededBy: doc.supersededBy } : {}),
      appliesTo: doc.appliesTo,
      effectiveDate: doc.effectiveDate,
    }
  })
}
