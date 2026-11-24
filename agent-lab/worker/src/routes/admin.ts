import type {
  AdminCodeRecord,
  AdminCreateCodesResponse,
  AdminListCodesResponse,
} from '../../../shared/api-types'
import { requireAdmin } from '../auth/admin'
import { generateCode, hashCode, normalizeCode } from '../codes'
import type { RequestContext } from '../context'
import { randomId } from '../crypto'
import { type AccessCodeRow, adminRecord, roundUsd } from '../db'
import { MIN_PEPPER_LENGTH } from '../env'
import { ApiError, isObject, json, readJson } from '../http'
import { LIMITS } from '../limits'

const MAX_LABEL = 120
const BOUNDS = {
  requestLimit: { min: 0, max: 10_000_000 },
  tokenLimit: { min: 0, max: 10_000_000_000 },
  maxSessions: { min: 1, max: 10_000 },
}

function intField(v: unknown, name: keyof typeof BOUNDS): number {
  const b = BOUNDS[name]
  if (typeof v !== 'number' || !Number.isInteger(v) || v < b.min || v > b.max) {
    throw new ApiError('invalid_request', `\`${name}\` must be an integer between ${b.min} and ${b.max}.`)
  }
  return v
}

function labelField(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string' || v.length > MAX_LABEL) {
    throw new ApiError('invalid_request', `\`label\` must be a string of at most ${MAX_LABEL} characters.`)
  }
  return v.trim() || null
}

function expiresField(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') throw new ApiError('invalid_request', '`expiresAt` must be an ISO timestamp or null.')
  // A bare date means "valid through the end of that day (UTC)".
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T23:59:59.999Z`) : Date.parse(v)
  if (!Number.isFinite(ms)) throw new ApiError('invalid_request', '`expiresAt` must be an ISO timestamp or null.')
  return ms
}

const SELECT_WITH_SESSIONS = `
  SELECT c.*,
         (SELECT COUNT(*) FROM sessions s
           WHERE s.access_code_id = c.id AND s.revoked_at IS NULL AND s.expires_at > ?1) AS active_sessions
    FROM access_codes c`

async function loadRecord(c: RequestContext, id: string): Promise<AdminCodeRecord> {
  const row = await c.env.DB.prepare(`${SELECT_WITH_SESSIONS} WHERE c.id = ?2`)
    .bind(Date.now(), id)
    .first<AccessCodeRow & { active_sessions: number }>()
  if (!row) throw new ApiError('not_found', 'No access code with this id.')
  return adminRecord(row, Date.now())
}

/** POST /api/admin/codes */
export async function handleCreateCodes(c: RequestContext): Promise<Response> {
  await requireAdmin(c.request, c.cfg, c.fetch)
  if (c.cfg.codePepper.length < MIN_PEPPER_LENGTH) throw new ApiError('internal', 'CODE_PEPPER is not configured.')
  const body = (await readJson(c.request, LIMITS.maxAdminBodyBytes)) ?? {}
  if (!isObject(body)) throw new ApiError('invalid_request', 'Body must be a JSON object.')

  const count = body.count === undefined ? 1 : body.count
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 200) {
    throw new ApiError('invalid_request', '`count` must be an integer between 1 and 200.')
  }
  const label = labelField(body.label)
  const expiresAt = expiresField(body.expiresAt)
  const requestLimit = body.requestLimit === undefined ? c.cfg.defaultRequestLimit : intField(body.requestLimit, 'requestLimit')
  const tokenLimit = body.tokenLimit === undefined ? c.cfg.defaultTokenLimit : intField(body.tokenLimit, 'tokenLimit')
  const maxSessions = body.maxSessions === undefined ? c.cfg.defaultMaxSessions : intField(body.maxSessions, 'maxSessions')

  const now = Date.now()
  const created: { code: string; row: AccessCodeRow }[] = []
  for (let i = 0; i < count; i++) {
    const code = generateCode()
    const row: AccessCodeRow = {
      id: randomId('code', 6),
      code_hash: await hashCode(c.cfg.codePepper, normalizeCode(code)!),
      label,
      created_at: now,
      expires_at: expiresAt,
      revoked_at: null,
      request_limit: requestLimit,
      token_limit: tokenLimit,
      max_sessions: maxSessions,
      requests_used: 0,
      tokens_used: 0,
      estimated_cost_usd: 0,
      status: 'active',
      last_used_at: null,
    }
    created.push({ code, row })
  }
  await c.env.DB.batch(
    created.map(({ row }) =>
      c.env.DB.prepare(
        `INSERT INTO access_codes (id, code_hash, label, created_at, expires_at, request_limit, token_limit, max_sessions, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active')`,
      ).bind(row.id, row.code_hash, row.label, row.created_at, row.expires_at, row.request_limit, row.token_limit, row.max_sessions),
    ),
  )
  console.log(JSON.stringify({ level: 'info', component: 'admin', action: 'create_codes', count, label }))
  const res: AdminCreateCodesResponse = {
    codes: created.map(({ code, row }) => ({ ...adminRecord(row, now), code })),
  }
  return json(res, 201)
}

/** GET /api/admin/codes */
export async function handleListCodes(c: RequestContext): Promise<Response> {
  await requireAdmin(c.request, c.cfg, c.fetch)
  const now = Date.now()
  const { results } = await c.env.DB.prepare(`${SELECT_WITH_SESSIONS} ORDER BY c.created_at DESC, c.id`)
    .bind(now)
    .all<AccessCodeRow & { active_sessions: number }>()
  const codes = results.map((r) => adminRecord(r, now))
  const totals = codes.reduce(
    (t, r) => ({ requests: t.requests + r.requestsUsed, tokens: t.tokens + r.tokensUsed, estimatedCostUsd: t.estimatedCostUsd + r.estimatedCostUsd }),
    { requests: 0, tokens: 0, estimatedCostUsd: 0 },
  )
  totals.estimatedCostUsd = roundUsd(totals.estimatedCostUsd)
  const res: AdminListCodesResponse = { codes, totals }
  return json(res)
}

/** PATCH /api/admin/codes/:id */
export async function handleUpdateCode(c: RequestContext): Promise<Response> {
  await requireAdmin(c.request, c.cfg, c.fetch)
  const id = c.params.id!
  const body = await readJson(c.request, LIMITS.maxAdminBodyBytes)
  if (!isObject(body)) throw new ApiError('invalid_request', 'Body must be a JSON object.')

  const existing = await c.env.DB.prepare('SELECT * FROM access_codes WHERE id = ?1').bind(id).first<AccessCodeRow>()
  if (!existing) throw new ApiError('not_found', 'No access code with this id.')

  const sets: string[] = []
  const args: unknown[] = []
  const set = (col: string, val: unknown) => {
    args.push(val)
    sets.push(`${col} = ?${args.length + 1}`)
  }
  if ('label' in body) set('label', labelField(body.label))
  if ('expiresAt' in body) set('expires_at', expiresField(body.expiresAt))
  if (body.requestLimit !== undefined) set('request_limit', intField(body.requestLimit, 'requestLimit'))
  if (body.tokenLimit !== undefined) set('token_limit', intField(body.tokenLimit, 'tokenLimit'))
  if (body.maxSessions !== undefined) set('max_sessions', intField(body.maxSessions, 'maxSessions'))
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'disabled') {
      throw new ApiError('invalid_request', '`status` must be "active" or "disabled".')
    }
    if (existing.status === 'revoked') throw new ApiError('invalid_request', 'A revoked code cannot be re-enabled; create a new one.')
    set('status', body.status)
  }
  if (body.resetUsage !== undefined && typeof body.resetUsage !== 'boolean') {
    throw new ApiError('invalid_request', '`resetUsage` must be a boolean.')
  }
  if (body.revokeSessions !== undefined && typeof body.revokeSessions !== 'boolean') {
    throw new ApiError('invalid_request', '`revokeSessions` must be a boolean.')
  }
  if (body.resetUsage) {
    set('requests_used', 0)
    set('tokens_used', 0)
    set('estimated_cost_usd', 0)
  }

  const now = Date.now()
  const stmts: D1PreparedStatement[] = []
  if (sets.length) {
    stmts.push(c.env.DB.prepare(`UPDATE access_codes SET ${sets.join(', ')} WHERE id = ?1`).bind(id, ...args))
  }
  if (body.revokeSessions) {
    stmts.push(c.env.DB.prepare('UPDATE sessions SET revoked_at = ?2 WHERE access_code_id = ?1 AND revoked_at IS NULL').bind(id, now))
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  console.log(JSON.stringify({ level: 'info', component: 'admin', action: 'update_code', id, fields: Object.keys(body) }))
  return json(await loadRecord(c, id))
}

/** DELETE /api/admin/codes/:id — revokes the code and all its sessions (the row and its usage are kept). */
export async function handleRevokeCode(c: RequestContext): Promise<Response> {
  await requireAdmin(c.request, c.cfg, c.fetch)
  const id = c.params.id!
  const now = Date.now()
  const existing = await c.env.DB.prepare('SELECT id FROM access_codes WHERE id = ?1').bind(id).first()
  if (!existing) throw new ApiError('not_found', 'No access code with this id.')
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE access_codes SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?2) WHERE id = ?1`,
    ).bind(id, now),
    c.env.DB.prepare('UPDATE sessions SET revoked_at = ?2 WHERE access_code_id = ?1 AND revoked_at IS NULL').bind(id, now),
  ])
  console.log(JSON.stringify({ level: 'info', component: 'admin', action: 'revoke_code', id }))
  return json(await loadRecord(c, id))
}
