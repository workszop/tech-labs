import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', async (orig) => {
  const real = await orig<typeof import('@/api/client')>()
  return {
    ...real,
    api: {
      ...real.api,
      embed: vi.fn(async () => ({ embeddings: [[1, 0]], model: 'm', dimensions: 2, usage: { inputTokens: 3 }, quota: null })),
      chat: vi.fn(async () => ({ answer: 'ok [1]', prompt: undefined, usage: undefined, finishReason: 'stop', quota: null })),
      usage: vi.fn(async () => null),
    },
  }
})

import { ask, openRunSource, runQuery } from './actions'
import { getState, setState } from './store'
import type { ChunkRecord } from '@/rag/db'

function chunk(docId: string, vector: number[], start: number, end: number): ChunkRecord {
  return {
    id: `${docId}#0`, docId, docTitle: `Doc ${docId}`, folder: 'f', chunkIndex: 0, text: `text ${docId}`, start, end, tokens: 3,
    overlapPrevChars: 0, overlapNextChars: 0, vector: new Float32Array(vector), model: 'm', dimensions: 2, docHash: 'h', createdAt: 0,
  }
}

const opts = () => ({ ragEnabled: true, compare: false, topK: 1, threshold: null, toChat: false, signal: new AbortController().signal })

beforeEach(() => {
  setState({
    chat: [], runs: {}, activeRunId: null,
    auth: {
      status: 'active', notice: null,
      session: {
        sessionRef: 'x', label: null, expiresAt: '', usage: { requestsUsed: 0, requestLimit: 10 },
        capabilities: { provider: 'mock', embeddingModel: 'm', embeddingDimensions: 2, chatModel: 'c', maxEmbeddingBatch: 8, maxEmbeddingInputTokens: 1000, maxContextChunks: 8, maxChatInputTokens: 8000, maxQuestionChars: 1000, maxOutputTokens: { min: 1, max: 1000, default: 500 }, temperature: { min: 0, max: 1, default: 0.2 }, streaming: true },
      } as never,
    },
    index: {
      meta: { model: 'm', dimensions: 2, chunkSize: 400, overlap: 60, labels: 'none' } as never,
      chunks: [chunk('a', [1, 0], 10, 40), chunk('b', [0, 1], 50, 90)],
      documents: {},
    },
  })
})

describe('runQuery', () => {
  it('runs a question without touching the chat', async () => {
    const before = getState().chat.length
    const run = await runQuery('q', opts())
    expect(getState().chat.length).toBe(before)
    expect(getState().activeRunId).not.toBe(run.id)
    expect(getState().runs[run.id]).toBeDefined()
    expect(run.context.docs?.map((d) => d.docId)).toEqual(['a'])
    expect(run.generate.status).toBe('completed')
    expect(run.generate.answer).toBe('ok [1]')
  })
  it('records the offsets of each fragment so an older run still opens the same passage', async () => {
    const run = await runQuery('q', opts())
    expect(run.context.docs?.[0]).toMatchObject({ docId: 'a', start: 10, end: 40 })
  })
  it('puts a chat question into the chat, as before', async () => {
    const before = getState().chat.length
    await ask('q')
    expect(getState().chat.length).toBe(before + 2)
  })
  it('resolves with an error run for an empty question without calling the API', async () => {
    const { api } = await import('@/api/client')
    vi.mocked(api.embed).mockClear()
    vi.mocked(api.chat).mockClear()
    const run = await runQuery('   ', opts())
    expect(run.generate.status).toBe('error')
    expect(api.embed).not.toHaveBeenCalled()
    expect(api.chat).not.toHaveBeenCalled()
  })
  it('is not aborted by a later chat question when it has its own signal', async () => {
    const own = new AbortController()
    const pending = runQuery('q', { ...opts(), signal: own.signal })
    await ask('another')
    const run = await pending
    expect(own.signal.aborted).toBe(false)
    expect(run.generate.status).toBe('completed')
  })
  it('resolves with an error run when the knowledge base is empty', async () => {
    setState({ index: { meta: null, chunks: [], documents: {} } })
    const run = await runQuery('q', opts())
    expect(run.generate.status).toBe('error')
  })
})

describe('opening a past run source fragment', () => {
  it('opens by the offsets kept with the run, even when the chunk id now points elsewhere', async () => {
    const run = await runQuery('q', opts())
    // Re-split: the same id now covers other characters.
    setState({ index: { ...getState().index, chunks: [chunk('a', [1, 0], 200, 300)] } })
    openRunSource(run, 0)
    expect(getState().ui.previewDocId).toBe('a')
    expect(getState().ui.previewHighlight).toEqual({ start: 10, end: 40, chunkId: 'a#0' })
  })
  it('falls back to the chunk id when the run kept no offsets', async () => {
    const run = await runQuery('q', opts())
    const old = { ...run, context: { ...run.context, docs: undefined } }
    setState({ ui: { ...getState().ui, previewDocId: null, previewHighlight: null } })
    openRunSource(old, 0)
    expect(getState().ui.previewHighlight).toEqual({ start: 10, end: 40, chunkId: 'a#0' })
  })
})
