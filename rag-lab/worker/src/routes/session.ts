import { bearerToken, requireSession, sessionIdFromToken, sessionInfo } from '../auth/session'
import type { RequestContext } from '../context'
import { SESSION_TOKEN_RE } from '../crypto'
import { usageInfo } from '../db'
import { ApiError, json, noContent } from '../http'

/** GET /api/session → SessionInfo */
export async function handleSession(c: RequestContext): Promise<Response> {
  const { session, code } = await requireSession(c.request, c.env.DB, c.cfg, c.now)
  return json(sessionInfo(session, code, c.cfg))
}

/** GET /api/usage → UsageInfo */
export async function handleUsage(c: RequestContext): Promise<Response> {
  const { code } = await requireSession(c.request, c.env.DB, c.cfg, c.now)
  return json(usageInfo(code))
}

/** POST /api/logout → 204. Idempotent: an already ended session also yields 204. */
export async function handleLogout(c: RequestContext): Promise<Response> {
  const token = bearerToken(c.request)
  if (!token || !SESSION_TOKEN_RE.test(token)) throw new ApiError('unauthorized', 'Missing or invalid session token.')
  const id = await sessionIdFromToken(token)
  await c.env.DB.prepare('UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL').bind(id, c.now).run()
  return noContent()
}
