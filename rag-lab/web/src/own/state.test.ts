import { describe, expect, it } from 'vitest'
import { INITIAL_OWN, askLock, estimateEmbedTokens, fitContext, needsRebuild, type OwnChunk, type OwnState } from './state'
import { getState, resetProgressState, setState, setUi } from '@/state/store'

const chunk = (id: string, tokens: number): OwnChunk => ({ id, docId: 'd', docName: 'a.txt', index: 0, text: 'x', tokens })

describe('fitContext', () => {
  const ranked = [chunk('a', 100), chunk('b', 100), chunk('c', 100)].map((c, i) => ({ chunk: c, score: 0.9 - i / 10 }))

  it('keeps every chunk under the budget', () => {
    const r = fitContext(ranked, 1000, 200)
    expect(r.kept.map((k) => k.chunk.id)).toEqual(['a', 'b', 'c'])
    expect(r.trimmed).toBe(0)
  })

  it('drops the lowest-ranked chunks first', () => {
    const r = fitContext(ranked, 450, 200)
    expect(r.kept.map((k) => k.chunk.id)).toEqual(['a', 'b'])
    expect(r.trimmed).toBe(1)
  })

  it('keeps nothing when even the best chunk does not fit', () => {
    const r = fitContext(ranked, 250, 200)
    expect(r.kept).toEqual([])
    expect(r.trimmed).toBe(3)
  })
})

describe('estimateEmbedTokens', () => {
  it('sums chunk tokens', () => {
    expect(estimateEmbedTokens([chunk('a', 10), chunk('b', 32)])).toBe(42)
  })
})

describe('needsRebuild', () => {
  const base: OwnState = { ...INITIAL_OWN, docs: [{ id: 'd1', name: 'a.txt', kind: 'txt', pages: 1, chars: 30, text: 'x'.repeat(30) }], chunkSize: 400, overlap: 60 }
  const indexed: OwnState = { ...base, indexed: { chunkSize: 400, overlap: 60, docIds: ['d1'] } }

  it('is false right after indexing and true after a change', () => {
    expect(needsRebuild(base)).toBe(true)
    expect(needsRebuild(indexed)).toBe(false)
    expect(needsRebuild({ ...indexed, chunkSize: 200 })).toBe(true)
    expect(needsRebuild({ ...indexed, docs: [] })).toBe(true)
  })
})

describe('askLock', () => {
  it('needs a code, then a Worker that knows profile own', () => {
    expect(askLock('browsing', undefined)).toBe('code')
    expect(askLock('active', { ownProfile: undefined })).toBe('worker')
    expect(askLock('active', { ownProfile: true })).toBeNull()
  })
})

describe('resetProgressState and own mode', () => {
  it('clears own documents and goes back to Rybex', () => {
    setState((s) => ({ own: { ...s.own, instructions: 'Punktami.', docs: [{ id: 'd1', name: 'a.txt', kind: 'txt', pages: 1, chars: 30, text: 'x'.repeat(30) }] } }))
    setUi({ mode: 'own' })
    resetProgressState()
    expect(getState().own).toEqual(INITIAL_OWN)
    expect(getState().ui.mode).toBe('rybex')
  })
})

describe('fitToWorker', () => {
  it('trims with the Worker estimate (characters / 4), not with cl100k tokens', async () => {
    const { fitToWorker } = await import('./state')
    const { buildChatMessages, estimateMessagesTokens } = await import('@shared/prompt')
    // Layout-heavy text: 4000 characters (1000 Worker tokens) but only 300 cl100k tokens each.
    const ranked = ['a', 'b', 'c'].map((id, i) => ({ chunk: { ...chunk(id, 300), text: '.'.repeat(4000) }, score: 0.9 - i / 10 }))
    const build = (kept: typeof ranked) =>
      buildChatMessages({ question: 'Q?', mode: 'rag', lang: 'pl', profile: 'own', context: kept.map((k) => ({ chunkId: k.chunk.id, documentTitle: 'a.txt', folder: 'own', text: k.chunk.text })) })
    const budget = estimateMessagesTokens(build(ranked.slice(0, 2)))
    const r = fitToWorker(ranked, build, budget)
    expect(r.kept.map((k) => k.chunk.id)).toEqual(['a', 'b'])
    expect(r.trimmed).toBe(1)
    expect(estimateMessagesTokens(build(r.kept))).toBeLessThanOrEqual(budget)
    expect(fitContext(ranked, budget, 0).kept).toHaveLength(3) // the old cl100k count would keep all three
  })
})

describe('polish from review (state)', () => {
  it('finds chunks over the per-input embedding limit by the Worker estimate', async () => {
    const { oversizedChunks } = await import('./state')
    expect(oversizedChunks([{ ...chunk('a', 1500), text: 'x'.repeat(8004) }, { ...chunk('b', 300), text: 'x'.repeat(1200) }], 2000).map((c) => c.id)).toEqual(['a'])
  })

  it('estimates the embedding cost from the price per million tokens', async () => {
    const { embedCostUsd } = await import('./state')
    expect(embedCostUsd(500_000, 0.02)).toBeCloseTo(0.01)
    expect(embedCostUsd(500_000, undefined)).toBeNull()
  })
})
