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
    auth: { status: 'active', notice: null, session: { capabilities: { maxEmbeddingBatch: 64, maxEmbeddingInputTokens: 2000, maxChatInputTokens: 12000, maxQuestionChars: 1000, ownProfile: true } } as never },
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

describe('polish from review (actions)', () => {
  it('queues files added while others are still being read', async () => {
    const { addOwnFiles } = await import('./actions')
    setState((s) => ({ own: { ...s.own, docs: [] } }))
    const f = (n: string) => new File([`Treść dokumentu ${n}, wystarczająco długa.`], `${n}.txt`, { type: 'text/plain' })
    await Promise.all([addOwnFiles([f('x')]), addOwnFiles([f('y')])])
    expect(getState().own.docs.map((d) => d.name)).toEqual(['x.txt', 'y.txt'])
  })

  it('refuses a question longer than the server allows, before any request', async () => {
    const { askOwn } = await import('./actions')
    const { api } = await import('@/api/client')
    setState((s) => ({ auth: { ...s.auth, session: { capabilities: { ...s.auth.session!.capabilities, maxQuestionChars: 10 } } as never }, own: { ...s.own, embed: { status: 'done', done: 2, total: 2, tokens: 5 }, chunks: s.own.chunks.map((c) => ({ ...c, vector: new Float32Array([1, 0]) })) } }))
    const calls = vi.mocked(api.embed).mock.calls.length
    await askOwn('x'.repeat(11))
    expect(vi.mocked(api.embed).mock.calls.length).toBe(calls)
    expect(getState().own.runs.at(-1)?.status).toBe('error')
  })

  it('gives an own-mode hint for a payload that is too large', async () => {
    const { ownErrorText } = await import('./actions')
    const { ApiError } = await import('@/api/client')
    const e = Object.assign(new ApiError('payload_too_large', 'x'), { code: 'payload_too_large' })
    expect(ownErrorText(e)).toMatch(/mniejsz/)
  })

  it('does not embed with oversized chunks or on a Worker without own support', async () => {
    const { api } = await import('@/api/client')
    const calls = vi.mocked(api.embed).mock.calls.length
    setState((s) => ({ own: { ...s.own, chunks: [{ ...s.own.chunks[0], text: 'x'.repeat(9000), tokens: 2000 }] } }))
    await embedOwn()
    setState((s) => ({ own: { ...s.own, chunks: [{ ...s.own.chunks[0], text: 'ok', tokens: 1 }] }, auth: { ...s.auth, session: { capabilities: { maxEmbeddingBatch: 64, maxEmbeddingInputTokens: 2000, maxChatInputTokens: 12000 } } as never } }))
    await embedOwn()
    expect(vi.mocked(api.embed).mock.calls.length).toBe(calls)
  })
})

describe('rejections of queued batches', () => {
  it('keeps the reasons of every batch added while files were still being read', async () => {
    const { addOwnFiles } = await import('./actions')
    setState((s) => ({ own: { ...s.own, docs: [], rejected: [] } }))
    const bad = (n: string) => new File(['x'], `${n}.pptx`, { type: 'application/vnd.ms-powerpoint' })
    await Promise.all([addOwnFiles([bad('one')]), addOwnFiles([bad('two')])])
    expect(getState().own.rejected.map((r) => r.name)).toEqual(['one.pptx', 'two.pptx'])
    await addOwnFiles([bad('three')])
    expect(getState().own.rejected.map((r) => r.name)).toEqual(['three.pptx'])
  })
})
