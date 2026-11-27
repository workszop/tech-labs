import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { MemoryStore, openVectorStore, type ChunkRecord, type IndexMeta } from './db'

const meta: IndexMeta = { key: 'index', model: 'm', dimensions: 3, chunkSize: 400, overlap: 60, tokenizer: 'cl100k_base', createdAt: 1, updatedAt: 1 }
const chunk = (docId: string, i: number): ChunkRecord => ({
  id: `${docId}#${i}`, docId, docTitle: docId, folder: 'hr', chunkIndex: i, text: `text ${i}`, start: 0, end: 5, tokens: 2,
  overlapPrevChars: 0, overlapNextChars: 0, vector: new Float32Array([i, 1, 0]), model: 'm', dimensions: 3, docHash: 'h', createdAt: 1,
})
const doc = (docId: string, n: number) => ({ docId, title: docId, folder: 'hr', docHash: 'h', chunkCount: n, tokens: 2 * n, indexedAt: 1 })

describe.each([
  ['IndexedDB (Dexie)', () => openVectorStore(`test-${Math.random()}`)],
  ['memory fallback', async () => new MemoryStore()],
])('%s vector store', (_name, make) => {
  it('persists chunks with Float32Array vectors and metadata', async () => {
    const s = await make()
    await s.replaceDocuments(meta, [doc('a', 2)], [chunk('a', 0), chunk('a', 1)], true)
    const loaded = await s.load()
    expect(loaded.meta?.model).toBe('m')
    expect(loaded.chunks).toHaveLength(2)
    expect(loaded.chunks[0].vector).toBeInstanceOf(Float32Array)
    expect(Array.from(loaded.chunks.find((c) => c.id === 'a#1')!.vector)).toEqual([1, 1, 0])
  })
  it('replaces a document without touching others, and removes documents', async () => {
    const s = await make()
    await s.replaceDocuments(meta, [doc('a', 2), doc('b', 1)], [chunk('a', 0), chunk('a', 1), chunk('b', 0)], true)
    await s.replaceDocuments(meta, [doc('a', 1)], [chunk('a', 0)], false)
    let l = await s.load()
    expect(l.chunks.map((c) => c.id).sort()).toEqual(['a#0', 'b#0'])
    await s.removeDocuments(['a'])
    l = await s.load()
    expect(l.chunks.map((c) => c.id)).toEqual(['b#0'])
    await s.removeDocuments(['b'])
    expect((await s.load()).meta).toBeNull()
  })
  it('caches embeddings by key', async () => {
    const s = await make()
    await s.putCached([{ key: 'k1', model: 'm', vector: new Float32Array([1, 2, 3]) }])
    const [hit, miss] = await s.getCached(['k1', 'k2'])
    expect(Array.from(hit!.vector)).toEqual([1, 2, 3])
    expect(miss).toBeUndefined()
    await s.clear()
    expect((await s.getCached(['k1']))[0]).toBeUndefined()
  })
})

it('reports persistence correctly', async () => {
  expect((await openVectorStore('p-test')).persistent).toBe(true)
  expect(new MemoryStore().persistent).toBe(false)
})

describe.each([
  ['IndexedDB (Dexie)', () => openVectorStore(`bench-test-${Math.random()}`)],
  ['memory fallback', async () => new MemoryStore()],
])('%s benchmark storage', (_name, make) => {
  it('stores benchmark cases and runs, and keeps the cases on clear', async () => {
    const store = await make()
    await store.putBenchCase({ id: 'u1', lang: 'pl', kind: 'ordinary', question: 'q', expectedDocIds: [], expectedAnswer: '', keyFacts: [], mustNotContain: [], builtIn: false })
    await store.putBenchRun({ id: 'r1', createdAt: 1, lang: 'pl', index: { docIds: [], docTitles: [], chunkSize: 400, overlap: 60, labels: 'none', chunks: 0 }, topK: 3, threshold: null, caseIds: ['u1'], totalActive: 1, status: 'done', results: [] })
    expect((await store.loadBenchmark()).runs).toHaveLength(1)
    await store.clear()
    const after = await store.loadBenchmark()
    expect(after.runs).toHaveLength(0)
    expect(after.cases.map((c) => c.id)).toEqual(['u1'])
  })
  it('deletes a case and clears runs on their own', async () => {
    const store = await make()
    await store.putBenchCase({ id: 'u1', lang: 'pl', kind: 'ordinary', question: 'q', expectedDocIds: [], expectedAnswer: '', keyFacts: [], mustNotContain: [], builtIn: false })
    await store.putBenchRun({ id: 'r1', createdAt: 1, lang: 'pl', index: { docIds: [], docTitles: [], chunkSize: 400, overlap: 60, labels: 'none', chunks: 0 }, topK: 3, threshold: null, caseIds: [], totalActive: 0, status: 'done', results: [] })
    await store.deleteBenchCase('u1')
    await store.clearBenchRuns()
    expect(await store.loadBenchmark()).toEqual({ cases: [], runs: [] })
  })
})
