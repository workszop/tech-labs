/**
 * Automatic retry for building the knowledge base index. A network blip, a
 * rate limit or a provider hiccup should not leave the index failed for the
 * whole session, so these errors are retried with growing delays (a
 * `rate_limited` answer is retried no earlier than its retry-after time).
 * Errors a retry cannot fix (spent quota, ended session, blocked storage) fail
 * at once.
 */
import { ApiError } from '@/api/client'

/** Waits before the 1st, 2nd and 3rd retry. */
export const KB_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000, 15_000]
/** Upper bound for a retry-after wait. */
const MAX_RETRY_AFTER_MS = 60_000

const TRANSIENT = new Set<string>(['network', 'rate_limited', 'upstream_unavailable', 'upstream_timeout', 'upstream_bad_response', 'internal'])

export function isTransientKbError(e: unknown): boolean {
  return e instanceof ApiError && TRANSIENT.has(e.code)
}

function abortError(): Error {
  return Object.assign(new Error('Aborted'), { name: 'AbortError' })
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export interface RetryOptions {
  delays?: readonly number[]
  signal?: AbortSignal
  /** Called before each wait: 1-based retry number and the wait in ms. */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void
}

export async function retryTransient<T>(task: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const delays = opts.delays ?? KB_RETRY_DELAYS_MS
  for (let attempt = 0; ; attempt++) {
    try {
      return await task()
    } catch (e) {
      if (opts.signal?.aborted) throw abortError()
      if (attempt >= delays.length || !isTransientKbError(e)) throw e
      const after = e instanceof ApiError && e.code === 'rate_limited' && e.retryAfterSeconds ? Math.min(e.retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS) : 0
      const delay = Math.max(delays[attempt]!, after)
      opts.onRetry?.(attempt + 1, delay, e)
      await wait(delay, opts.signal)
    }
  }
}
