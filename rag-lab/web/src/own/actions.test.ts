import { beforeEach, describe, expect, it, vi } from 'vitest'

// api.embed resolves only when the test says so, to act while embedding is in flight.
const pending: ((v: unknown) => void)[] = []
vi.mock('@/api/client', () => ({
  ApiError: class extends Error {},
  api: {
    embed: vi.fn((inputs: string[]) => new Promise((resolve) => pending.push(() => resolve({ embeddings: inputs.map(() => [1, 0]), usage: { inputTokens: 5 }, quota: {} })))),
    usage: vi.fn(async () => ({})),
  },
}))

import { getState, resetProgressState, setState } from '@/state/store'
import { INITIAL_OWN } from './state'
import { abortOwn, embedOwn, removeOwnDoc } from './actions'

const doc = (id: string) => ({ id, name: `${id}.txt`, kind: 'txt' as const, pages: 1, chars: 40, text: 'x'.repeat(40) })
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  pending.length = 0
  setState(() => ({
    auth: { status: 'active', notice: null, session: { capabilities: { maxEmbeddingBatch: 64, maxChatInputTokens: 12000, ownProfile: true } } as never },
    own: {
      ...INITIAL_OWN,
      docs: [doc('a'), doc('b')],
      chunks: [
        { id: 'a#0', docId: 'a', docName: 'a.txt', index: 0, text: 'aa', tokens: 10 },
        { id: 'b#0', docId: 'b', docName: 'b.txt', index: 0, text: 'bb', tokens: 10 },
      ],
      split: { chunkSize: 400, overlap: 60, docIds: ['a', 'b'] },
    },
  }))
})

describe('embedOwn and later changes', () => {
  it('a document removed while embedding stops the run: no vectors, no index', async () => {
    const run = embedOwn()
    await flush()
    removeOwnDoc('b')
    pending.forEach((f) => f(undefined))
    await run
    expect(getState().own.indexed).toBeNull()
    expect(getState().own.embed.status).not.toBe('done')
  })

  it('start again during embedding leaves the fresh own state untouched', async () => {
    const run = embedOwn()
    await flush()
    abortOwn()
    resetProgressState()
    pending.forEach((f) => f(undefined))
    await run
    expect(getState().own).toEqual(INITIAL_OWN)
  })
})

describe('resetAllProgress', () => {
  it('stops a running own embedding (no late writes)', async () => {
    const { resetAllProgress } = await import('@/state/actions')
    const run = embedOwn()
    await flush()
    await resetAllProgress()
    pending.forEach((f) => f(undefined))
    await run
    expect(getState().own).toEqual(INITIAL_OWN)
  })
})

describe('ownAskReady', () => {
  it('needs finished vectors that match the current split', async () => {
    const { ownAskReady } = await import('./state')
    const o = { ...getState().own, embed: { status: 'done' as const, done: 2, total: 2, tokens: 5 }, indexed: { chunkSize: 400, overlap: 60, docIds: ['a', 'b'] } }
    expect(ownAskReady(o)).toBe(true)
    expect(ownAskReady({ ...o, split: { chunkSize: 600, overlap: 60, docIds: ['a', 'b'] } })).toBe(false)
    expect(ownAskReady({ ...o, embed: { ...o.embed, status: 'running' } })).toBe(false)
  })
})
