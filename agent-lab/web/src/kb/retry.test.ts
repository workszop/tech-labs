import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import { isTransientKbError, KB_RETRY_DELAYS_MS, retryTransient } from './retry'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('knowledge base index retry (final fix finding 3)', () => {
  it('retries transient failures with growing delays and then succeeds', async () => {
    const task = vi.fn<() => Promise<string>>()
    task.mockRejectedValueOnce(new ApiError('network', 'offline')).mockRejectedValueOnce(new ApiError('upstream_unavailable', 'down', 502)).mockResolvedValue('ok')
    const retries: number[] = []
    const p = retryTransient(task, { onRetry: (_attempt, delay) => retries.push(delay) })
    await vi.advanceTimersByTimeAsync(0)
    expect(task).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(KB_RETRY_DELAYS_MS[0]! - 1)
    expect(task).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(task).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(KB_RETRY_DELAYS_MS[1]!)
    await expect(p).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(3)
    expect(retries).toEqual([KB_RETRY_DELAYS_MS[0], KB_RETRY_DELAYS_MS[1]])
  })

  it('waits at least the retry-after time of rate_limited', async () => {
    const task = vi.fn<() => Promise<string>>()
    task.mockRejectedValueOnce(new ApiError('rate_limited', 'slow down', 429, 20)).mockResolvedValue('ok')
    const p = retryTransient(task)
    await vi.advanceTimersByTimeAsync(19_999)
    expect(task).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(p).resolves.toBe('ok')
  })

  it('gives up after the last delay and rethrows the last error', async () => {
    const task = vi.fn<() => Promise<string>>().mockRejectedValue(new ApiError('upstream_timeout', 'slow', 504))
    const p = retryTransient(task)
    const caught = p.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(KB_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0))
    expect(await caught).toMatchObject({ code: 'upstream_timeout' })
    expect(task).toHaveBeenCalledTimes(KB_RETRY_DELAYS_MS.length + 1)
  })

  it('does not retry errors that a retry cannot fix', async () => {
    for (const err of [new ApiError('quota_exceeded', 'spent', 402), new ApiError('session_expired', 'gone', 401), new Error('IndexedDB blocked')]) {
      expect(isTransientKbError(err)).toBe(false)
      const task = vi.fn<() => Promise<string>>().mockRejectedValue(err)
      await expect(retryTransient(task)).rejects.toBe(err)
      expect(task).toHaveBeenCalledTimes(1)
    }
  })

  it('stops waiting when the signal aborts', async () => {
    const ctl = new AbortController()
    const task = vi.fn<() => Promise<string>>().mockRejectedValue(new ApiError('network', 'offline'))
    const p = retryTransient(task, { signal: ctl.signal })
    const caught = p.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(10)
    ctl.abort()
    expect(await caught).toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(task).toHaveBeenCalledTimes(1)
  })
})
