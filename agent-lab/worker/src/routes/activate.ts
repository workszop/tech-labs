/**
 * POST /api/activate — exchange an access code for a session bearer token.
 *
 * Brute-force protection:
 *  - per-client-IP fixed window (key = HMAC(pepper, CF-Connecting-IP), never the raw IP).
 *    Every attempt increments the counter up front (atomic), a successful
 *    activation gives its slot back → the window effectively counts failed and
 *    in-flight attempts, so parallel guessing cannot slip past the check.
 *  - a global ceiling on failed attempts per minute (all IPs together).
 *  - all failures are padded to ACTIVATION_MIN_RESPONSE_MS (constant-ish time),
 *    and unknown / malformed codes get the identical `invalid_code` response.
 */
import type { ActivateResponse } from '../../../shared/api-types'
import { sessionIdFromToken, sessionInfo, type SessionRow } from '../auth/session'
import { hashCode, normalizeCode } from '../codes'
import type { RequestContext } from '../context'
import { hmacSha256Hex, newSessionToken } from '../crypto'
import { type AccessCodeRow, assertCodeUsable, decrementCounter, hitCounter, readCounter } from '../db'
import { MIN_PEPPER_LENGTH } from '../env'
import { ApiError, isObject, json, readJson } from '../http'
import { LIMITS } from '../limits'

const GLOBAL_FAIL_KEY = 'act:global-fail'
const GLOBAL_WINDOW_MS = 60_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function handleActivate(c: RequestContext): Promise<Response> {
  const { cfg, env, now } = c
  if (cfg.codePepper.length < MIN_PEPPER_LENGTH) {
    console.error(JSON.stringify({ level: 'error', component: 'config', error: 'CODE_PEPPER missing or too short' }))
    throw new ApiError('internal', 'The server is not configured yet.')
  }
  const body = await readJson(c.request, LIMITS.maxActivateBodyBytes)
  if (!isObject(body) || typeof body.code !== 'string') {
    throw new ApiError('invalid_request', 'Body must be {"code": "AGT-…"}.')
  }

  // Global failure ceiling (checked first, cheap read).
  const global = await readCounter(env.DB, GLOBAL_FAIL_KEY, GLOBAL_WINDOW_MS, now)
  if (global.count >= cfg.activationGlobalFailuresPerMinute) {
    throw new ApiError('rate_limited', 'Too many failed activation attempts right now. Please wait a moment.', global.retryAfterSeconds)
  }

  const ip = c.request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const ipKey = `act:ip:${(await hmacSha256Hex(cfg.codePepper, `ip:${ip}`)).slice(0, 32)}`
  const windowMs = cfg.activationWindowSeconds * 1000
  const hit = await hitCounter(env.DB, ipKey, windowMs, now)
  if (hit.count > cfg.activationMaxAttempts) {
    throw new ApiError('rate_limited', 'Too many activation attempts from your network. Please wait and try again.', hit.retryAfterSeconds)
  }

  const started = Date.now()
  const fail = async (err: ApiError): Promise<never> => {
    await hitCounter(env.DB, GLOBAL_FAIL_KEY, GLOBAL_WINDOW_MS, now).catch(() => {})
    const wait = cfg.activationMinResponseMs - (Date.now() - started)
    if (wait > 0) await sleep(wait + Math.random() * 50)
    throw err
  }
  const giveBackSlot = () => decrementCounter(env.DB, ipKey, hit.windowStart).catch(() => {})

  // Always compute an HMAC, even for malformed input, so timing does not reveal the format check.
  const normalized = body.code.length <= LIMITS.maxCodeInputChars ? normalizeCode(body.code) : null
  const codeHash = await hashCode(cfg.codePepper, normalized ?? `invalid:${body.code.slice(0, LIMITS.maxCodeInputChars)}`)
  const code = normalized
    ? await env.DB.prepare('SELECT * FROM access_codes WHERE code_hash = ?1').bind(codeHash).first<AccessCodeRow>()
    : null
  if (!code) return fail(new ApiError('invalid_code', 'This access code is not valid. Check for typos and try again.'))

  try {
    assertCodeUsable(code, now)
  } catch (err) {
    return fail(err as ApiError)
  }

  // Create the session only if the code still has a free session slot (single atomic statement).
  const token = newSessionToken()
  const sessionId = await sessionIdFromToken(token)
  const ttlEnd = now + cfg.sessionTtlMinutes * 60_000
  const expiresAt = code.expires_at !== null ? Math.min(ttlEnd, code.expires_at) : ttlEnd
  const idleCutoff = cfg.sessionIdleTimeoutMinutes > 0 ? now - cfg.sessionIdleTimeoutMinutes * 60_000 : 0
  const session = await env.DB.prepare(
    `INSERT INTO sessions (id, access_code_id, created_at, expires_at, revoked_at, last_activity_at)
     SELECT ?1, c.id, ?3, ?4, NULL, ?3
       FROM access_codes c
      WHERE c.id = ?2
        AND (SELECT COUNT(*) FROM sessions s
              WHERE s.access_code_id = c.id AND s.revoked_at IS NULL
                AND s.expires_at > ?3 AND s.last_activity_at >= ?5) < c.max_sessions
     RETURNING *`,
  )
    .bind(sessionId, code.id, now, expiresAt, idleCutoff)
    .first<SessionRow>()

  await giveBackSlot()
  if (!session) {
    throw new ApiError(
      'too_many_sessions',
      `This access code is already in use in ${code.max_sessions} active session(s). Log out elsewhere or ask the organiser for help.`,
    )
  }
  await env.DB.prepare('UPDATE access_codes SET last_used_at = ?2 WHERE id = ?1').bind(code.id, now).run()

  const res: ActivateResponse = { token, session: sessionInfo(session, code, cfg) }
  return json(res)
}
