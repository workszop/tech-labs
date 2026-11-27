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

import { ask, runQuery } from './actions'
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
  it('resolves with an error run when the knowledge base is empty', async () => {
    setState({ index: { meta: null, chunks: [], documents: {} } })
    const run = await runQuery('q', opts())
    expect(run.generate.status).toBe('error')
  })
})
