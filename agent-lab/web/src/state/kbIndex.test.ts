import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmbeddingsResponse, SessionInfo } from '@shared/api-types'

const embed = vi.fn<(inputs: string[]) => Promise<EmbeddingsResponse>>()
vi.mock('@/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/api/client')>()
  return { ...real, api: { ...real.api, embed: (inputs: string[]) => embed(inputs) }, onAuthLost: () => () => undefined }
})

const { ApiError } = await import('@/api/client')
const { ensureKbIndex, retryKbIndex, __setKbRetryDelaysForTests, activateSession } = await import('./actions')
const { getState, setState, INITIAL_KB_INDEX } = await import('./store')
const { kbDb } = await import('@/kb/db')

const QUOTA = { requestsUsed: 1, requestLimit: 100, tokensUsed: 1, tokenLimit: 1000, estimatedCostUsd: 0, codeExpiresAt: null }
const SESSION = {
  sessionRef: 'abc', label: null, expiresAt: '2026-12-01T00:00:00Z', usage: QUOTA,
  capabilities: { provider: 'mock', embeddingModel: 'mock-embed', chatModel: 'mock-rule-based-agent', agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 80000, maxMessageChars: 1000 } },
} as unknown as SessionInfo

const ok = async (inputs: string[]): Promise<EmbeddingsResponse> => ({
  model: 'mock-embed', dimensions: 3, embeddings: inputs.map((_, i) => [1, i % 7, 0.5]), usage: { inputTokens: inputs.length }, durationMs: 1, quota: QUOTA,
})

beforeEach(async () => {
  await kbDb.meta.clear()
  await kbDb.vectors.clear()
  embed.mockReset()
  __setKbRetryDelaysForTests([5, 5, 5])
  setState({ auth: { status: 'active', session: SESSION, notice: null }, settings: { lang: 'en' }, kbIndex: INITIAL_KB_INDEX })
})

describe('knowledge base index recovery (final fix finding 3)', () => {
  it('a transient failure is retried automatically and the index ends ready', async () => {
    embed.mockRejectedValueOnce(new ApiError('network', 'offline')).mockRejectedValueOnce(new ApiError('rate_limited', 'slow', 429)).mockImplementation(ok)
    await ensureKbIndex()
    expect(getState().kbIndex).toMatchObject({ status: 'ready', error: null })
  })

  it('after the retries are used up the index shows a failed state; Retry builds it', async () => {
    embed.mockRejectedValue(new ApiError('upstream_unavailable', 'The AI model provider is not responding right now.', 502))
    await ensureKbIndex()
    expect(getState().kbIndex.status).toBe('error')
    expect(getState().kbIndex.error).toMatch(/not responding/)
    expect(embed).toHaveBeenCalledTimes(4)
    embed.mockReset()
    embed.mockImplementation(ok)
    await retryKbIndex()
    expect(getState().kbIndex.status).toBe('ready')
  })

  it('a failure a retry cannot fix fails at once', async () => {
    embed.mockRejectedValue(new ApiError('quota_exceeded', 'spent', 402))
    await ensureKbIndex()
    expect(getState().kbIndex.status).toBe('error')
    expect(embed).toHaveBeenCalledTimes(1)
  })

  it('a new valid session retries a failed index', async () => {
    embed.mockRejectedValue(new ApiError('quota_exceeded', 'spent', 402))
    await ensureKbIndex()
    expect(getState().kbIndex.status).toBe('error')
    embed.mockReset()
    embed.mockImplementation(ok)
    await activateSession(SESSION)
    await vi.waitFor(() => expect(getState().kbIndex.status).toBe('ready'))
  })
})
