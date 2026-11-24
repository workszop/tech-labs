/* Copied from rag-lab/web/src/rag/similarity.ts. */
/**
 * Exact (brute-force) cosine similarity search. For an educational index of a
 * few hundred chunks a linear scan takes well under a millisecond, so no
 * approximate-nearest-neighbour structure is needed, and every score shown in
 * the UI is the real, exact value.
 */

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export function norm(a: ArrayLike<number>): number {
  return Math.sqrt(dot(a, a))
}

/** cos(θ) = (a·b) / (‖a‖‖b‖), in [-1, 1]. Throws on dimension mismatch. */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new DimensionMismatchError(a.length, b.length)
  const na = norm(a)
  const nb = norm(b)
  if (na === 0 || nb === 0) return 0
  return dot(a, b) / (na * nb)
}

export class DimensionMismatchError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Embedding dimension mismatch: index vectors have ${expected} dimensions, the query vector has ${actual}.`)
    this.name = 'DimensionMismatchError'
  }
}

export interface Searchable {
  id: string
  vector: Float32Array
}

export interface ScoredResult<T> {
  item: T
  score: number
  rank: number
}

/** Score every item against the query and return them all, best first. */
export function rankBySimilarity<T extends Searchable>(query: ArrayLike<number>, items: T[]): ScoredResult<T>[] {
  const qn = norm(query)
  const scored = items.map((item) => {
    if (item.vector.length !== query.length) throw new DimensionMismatchError(item.vector.length, query.length)
    const n = norm(item.vector)
    const score = qn === 0 || n === 0 ? 0 : dot(query, item.vector) / (qn * n)
    return { item, score, rank: 0 }
  })
  scored.sort((a, b) => b.score - a.score || (a.item.id < b.item.id ? -1 : 1))
  scored.forEach((s, i) => (s.rank = i + 1))
  return scored
}

export function selectTopK<T>(ranked: ScoredResult<T>[], k: number, threshold?: number | null): ScoredResult<T>[] {
  const kk = Math.max(1, Math.min(10, Math.round(k)))
  return ranked.filter((r) => threshold == null || r.score >= threshold).slice(0, kk)
}
