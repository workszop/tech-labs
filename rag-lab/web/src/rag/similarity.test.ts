import { describe, expect, it } from 'vitest'
import { cosineSimilarity, DimensionMismatchError, rankBySimilarity, selectTopK } from './similarity'

describe('cosineSimilarity', () => {
  it('is 1 for parallel, 0 for orthogonal, -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 5])).toBeCloseTo(0)
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1)
  })
  it('is scale invariant and handles zero vectors', () => {
    expect(cosineSimilarity([3, 4], [6, 8])).toBeCloseTo(1)
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })
  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(DimensionMismatchError)
  })
})

describe('rankBySimilarity / selectTopK', () => {
  const items = [
    { id: 'a', vector: new Float32Array([1, 0, 0]) },
    { id: 'b', vector: new Float32Array([0.9, 0.1, 0]) },
    { id: 'c', vector: new Float32Array([0, 1, 0]) },
    { id: 'd', vector: new Float32Array([-1, 0, 0]) },
  ]
  it('ranks all items best first with 1-based ranks', () => {
    const r = rankBySimilarity([1, 0, 0], items)
    expect(r.map((x) => x.item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4])
    expect(r[0].score).toBeCloseTo(1)
  })
  it('selects top-k with clamping and optional threshold', () => {
    const r = rankBySimilarity([1, 0, 0], items)
    expect(selectTopK(r, 2).map((x) => x.item.id)).toEqual(['a', 'b'])
    expect(selectTopK(r, 0).length).toBe(1)
    expect(selectTopK(r, 50).length).toBe(4)
    expect(selectTopK(r, 4, 0.5).map((x) => x.item.id)).toEqual(['a', 'b'])
  })
  it('rejects mixed dimensions', () => {
    expect(() => rankBySimilarity([1, 0], items)).toThrow(DimensionMismatchError)
  })
})
