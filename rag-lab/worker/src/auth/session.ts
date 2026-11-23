import type { SessionInfo } from '../../../shared/api-types'
import { SESSION_TOKEN_RE, sha256Hex } from '../crypto'
import { type AccessCodeRow, assertCodeUsable, usageInfo } from '../db'
import type { Config } from '../env'
import { ApiError, iso } from '../http'
import { capabilities } from '../limits'

export interface SessionRow {
  id: string
  access_code_id: string
  created_at: number
  expires_at: number
  revoked_at: number | null
  last_activity_at: number
}

export interface AuthedSession {
  session: SessionRow
  code: AccessCodeRow
}

/** Extracts a bearer token from the Authorization header only (never from the URL). */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(\S+)\s*$/i.exec(h)
  return m ? m[1]! : null
}

export function sessionIdFromToken(token: string): Promise<string> {
  return sha256Hex(token)
}

/**
 * Authenticates a participant request. Updates `last_activity_at` (sliding activity
 * for the optional idle timeout). Absolute expiry (`expires_at`) never slides.
 */
export async function requireSession(request: Request, db: D1Database, cfg: Config, now: number): Promise<AuthedSession> {
  const token = bearerToken(request)
  if (!token || !SESSION_TOKEN_RE.test(token)) {
    throw new ApiError('unauthorized', 'Missing or invalid session token. Activate an access code first.')
  }
  const id = await sessionIdFromToken(token)
  const joined = await db
    .prepare(
      `SELECT s.id AS s_id, s.access_code_id AS s_access_code_id, s.created_at AS s_created_at,
              s.expires_at AS s_expires_at, s.revoked_at AS s_revoked_at, s.last_activity_at AS s_last_activity_at,
              c.*
         FROM sessions s JOIN access_codes c ON c.id = s.access_code_id
        WHERE s.id = ?1`,
    )
    .bind(id)
    .first<Record<string, unknown>>()
  if (!joined) throw new ApiError('unauthorized', 'Unknown session token. Activate an access code first.')

  const session: SessionRow = {
    id: joined.s_id as string,
    access_code_id: joined.s_access_code_id as string,
    created_at: joined.s_created_at as number,
    expires_at: joined.s_expires_at as number,
    revoked_at: (joined.s_revoked_at as number | null) ?? null,
    last_activity_at: joined.s_last_activity_at as number,
  }
  const code = joined as unknown as AccessCodeRow

  if (session.revoked_at !== null || session.expires_at <= now) {
    throw new ApiError('session_expired', 'Your session has ended. Please enter your access code again.')
  }
  if (cfg.sessionIdleTimeoutMinutes > 0 && now - session.last_activity_at > cfg.sessionIdleTimeoutMinutes * 60_000) {
    throw new ApiError('session_expired', 'Your session timed out after inactivity. Please enter your access code again.')
  }
  assertCodeUsable(code, now)

  await db.prepare('UPDATE sessions SET last_activity_at = ?2 WHERE id = ?1').bind(id, now).run()
  session.last_activity_at = now
  return { session, code }
}

export function sessionInfo(session: SessionRow, code: AccessCodeRow, cfg: Config): SessionInfo {
  return {
    sessionRef: session.id.slice(0, 8),
    label: code.label,
    expiresAt: iso(session.expires_at)!,
    capabilities: capabilities(cfg),
    usage: usageInfo(code),
  }
}
