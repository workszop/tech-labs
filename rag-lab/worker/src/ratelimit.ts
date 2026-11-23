import type { RequestContext } from './context'
import { hitCounter } from './db'
import { ApiError } from './http'

const WINDOW_MS = 60_000

/**
 * Per-session fixed-window limit (RATE_LIMIT_PER_MINUTE) using an atomic D1
 * upsert counter. If a Workers Rate Limiting binding (RATE_LIMITER) is
 * configured it is consulted as an additional, cheaper first line.
 */
export async function enforceSessionRateLimit(c: RequestContext, sessionId: string): Promise<void> {
  if (c.env.RATE_LIMITER) {
    try {
      const { success } = await c.env.RATE_LIMITER.limit({ key: `s:${sessionId}` })
      if (!success) throw new ApiError('rate_limited', 'Too many requests. Please slow down.', 60)
    } catch (err) {
      if (err instanceof ApiError) throw err
      // Binding failure: fall through to the D1 limiter.
    }
  }
  const hit = await hitCounter(c.env.DB, `rl:s:${sessionId}`, WINDOW_MS, c.now)
  if (hit.count > c.cfg.rateLimitPerMinute) {
    throw new ApiError(
      'rate_limited',
      `Too many requests (limit ${c.cfg.rateLimitPerMinute} per minute). Please wait a moment.`,
      hit.retryAfterSeconds,
    )
  }
}
