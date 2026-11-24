import type { AdminCodeRecord, CodeStatus, UsageInfo } from '../../shared/api-types'
import { ApiError, iso } from './http'

export interface AccessCodeRow {
  id: string
  code_hash: string
  label: string | null
  created_at: number
  expires_at: number | null
  revoked_at: number | null
  request_limit: number
  token_limit: number
  max_sessions: number
  requests_used: number
  tokens_used: number
  estimated_cost_usd: number
  status: 'active' | 'disabled' | 'revoked'
  last_used_at: number | null
}

export function usageInfo(row: AccessCodeRow): UsageInfo {
  return {
    requestsUsed: row.requests_used,
    requestLimit: row.request_limit,
    tokensUsed: row.tokens_used,
    tokenLimit: row.token_limit,
    estimatedCostUsd: roundUsd(row.estimated_cost_usd),
    codeExpiresAt: iso(row.expires_at),
  }
}

export function roundUsd(n: number): number {
  return Math.round(n * 1e8) / 1e8
}

export function deriveStatus(row: AccessCodeRow, now: number): CodeStatus {
  if (row.status === 'revoked' || row.revoked_at !== null) return 'revoked'
  if (row.status === 'disabled') return 'disabled'
  if (row.expires_at !== null && row.expires_at <= now) return 'expired'
  if (row.requests_used >= row.request_limit || row.tokens_used >= row.token_limit) return 'exhausted'
  return 'active'
}

export function adminRecord(row: AccessCodeRow & { active_sessions?: number }, now: number): AdminCodeRecord {
  return {
    id: row.id,
    label: row.label,
    status: deriveStatus(row, now),
    createdAt: iso(row.created_at)!,
    expiresAt: iso(row.expires_at),
    revokedAt: iso(row.revoked_at),
    requestLimit: row.request_limit,
    tokenLimit: row.token_limit,
    maxSessions: row.max_sessions,
    requestsUsed: row.requests_used,
    tokensUsed: row.tokens_used,
    estimatedCostUsd: roundUsd(row.estimated_cost_usd),
    activeSessions: row.active_sessions ?? 0,
    lastUsedAt: iso(row.last_used_at),
  }
}

/** Throws the participant-facing error for a code that cannot be used right now (or returns if usable). */
export function assertCodeUsable(row: AccessCodeRow, now: number): void {
  if (row.status === 'revoked' || row.revoked_at !== null) {
    throw new ApiError('revoked_code', 'This access code has been revoked by the administrator.')
  }
  if (row.status === 'disabled') {
    throw new ApiError('revoked_code', 'This access code is currently disabled by the administrator.')
  }
  if (row.expires_at !== null && row.expires_at <= now) {
    throw new ApiError('expired_code', 'This access code has expired.')
  }
}

// ---------------------------------------------------------------- fixed-window counters

/**
 * Atomically increments the counter of the current fixed window and returns
 * the new count plus seconds until the window resets.
 */
export async function hitCounter(
  db: D1Database,
  key: string,
  windowMs: number,
  now: number,
  by = 1,
): Promise<{ count: number; retryAfterSeconds: number; windowStart: number }> {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, ?3)
       ON CONFLICT (key, window_start) DO UPDATE SET count = count + ?3
       RETURNING count`,
    )
    .bind(key, windowStart, by)
    .first<{ count: number }>()
  return {
    count: row?.count ?? by,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    windowStart,
  }
}

export async function readCounter(db: D1Database, key: string, windowMs: number, now: number) {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const row = await db
    .prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2')
    .bind(key, windowStart)
    .first<{ count: number }>()
  return { count: row?.count ?? 0, retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) }
}

export async function decrementCounter(db: D1Database, key: string, windowStart: number): Promise<void> {
  await db
    .prepare('UPDATE rate_limits SET count = MAX(count - 1, 0) WHERE key = ?1 AND window_start = ?2')
    .bind(key, windowStart)
    .run()
}

// ---------------------------------------------------------------- quota

/**
 * Reserves one request and `estTokens` tokens in a single conditional UPDATE.
 * D1 executes statements serially, so concurrent requests can never overshoot the limits.
 * On failure, figures out the most precise reason (revoked / disabled / expired / quota).
 */
export async function reserveQuota(db: D1Database, codeId: string, estTokens: number, now: number): Promise<AccessCodeRow> {
  const row = await db
    .prepare(
      `UPDATE access_codes
          SET requests_used = requests_used + 1,
              tokens_used   = tokens_used + ?2,
              last_used_at  = ?3
        WHERE id = ?1
          AND status = 'active'
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?3)
          AND requests_used + 1 <= request_limit
          AND tokens_used + ?2 <= token_limit
      RETURNING *`,
    )
    .bind(codeId, estTokens, now)
    .first<AccessCodeRow>()
  if (row) return row

  const current = await db.prepare('SELECT * FROM access_codes WHERE id = ?1').bind(codeId).first<AccessCodeRow>()
  if (!current) throw new ApiError('unauthorized', 'Unknown session.')
  assertCodeUsable(current, now)
  if (current.requests_used + 1 > current.request_limit) {
    throw new ApiError('quota_exceeded', 'The request budget of this access code is used up.')
  }
  throw new ApiError(
    'quota_exceeded',
    current.tokens_used >= current.token_limit
      ? 'The token budget of this access code is used up.'
      : 'This request needs more tokens than remain in the budget of this access code. Try fewer or shorter inputs, or a lower max tokens setting.',
  )
}

export interface UsageEvent {
  accessCodeId: string
  sessionId: string
  model: string
  operation: 'embeddings' | 'agent'
  inputTokens: number
  outputTokens: number
  cost: number
  status: 'ok' | 'error' | 'aborted'
}

/**
 * After the upstream call: replace the token estimate with actual usage, add
 * cost, and log a usage_events row - in one D1 batch (atomic).
 * On failure pass actual tokens 0 -> the token reservation is refunded, the
 * request itself stays counted (it consumed a slot in the request budget).
 */
export async function settleUsage(
  db: D1Database,
  ev: UsageEvent,
  estTokens: number,
  now: number,
): Promise<AccessCodeRow | null> {
  const actual = ev.inputTokens + ev.outputTokens
  const delta = actual - estTokens
  const [, upd] = await db.batch<AccessCodeRow>([
    db
      .prepare(
        `INSERT INTO usage_events (id, access_code_id, session_id, model, operation, input_tokens, output_tokens, estimated_cost, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
      )
      .bind(crypto.randomUUID(), ev.accessCodeId, ev.sessionId, ev.model, ev.operation, ev.inputTokens, ev.outputTokens, ev.cost, ev.status, now),
    db
      .prepare(
        `UPDATE access_codes
            SET tokens_used = MAX(tokens_used + ?2, 0),
                estimated_cost_usd = estimated_cost_usd + ?3
          WHERE id = ?1
        RETURNING *`,
      )
      .bind(ev.accessCodeId, delta, ev.cost),
  ])
  return (upd?.results?.[0] as AccessCodeRow | undefined) ?? null
}
