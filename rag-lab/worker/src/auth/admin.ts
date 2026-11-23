/**
 * Admin authentication — completely separate from participant sessions.
 *
 * 1. Cloudflare Access: when ACCESS_TEAM_DOMAIN + ACCESS_AUD are set and the
 *    request carries `Cf-Access-Jwt-Assertion`, the RS256 JWT is verified
 *    against the team's JWKS (aud / iss / exp / nbf checked, keys cached).
 * 2. `Authorization: Bearer <ADMIN_TOKEN>` compared in constant time.
 *    Rejected entirely when ADMIN_TOKEN is unset or shorter than 24 chars.
 *
 * Participant session tokens never match ADMIN_TOKEN, and session lookup is
 * never attempted on admin routes.
 */
import { base64urlDecode, timingSafeEqualStr } from '../crypto'
import { type Config, MIN_ADMIN_TOKEN_LENGTH } from '../env'
import { ApiError } from '../http'
import { bearerToken } from './session'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface AdminIdentity {
  method: 'access' | 'token'
  subject: string
}

export async function requireAdmin(request: Request, cfg: Config, fetchImpl: FetchLike = fetch): Promise<AdminIdentity> {
  const accessConfigured = Boolean(cfg.accessTeamDomain && cfg.accessAud)
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (accessConfigured && assertion) {
    const claims = await verifyAccessJwt(assertion, cfg.accessTeamDomain, cfg.accessAud, Date.now(), fetchImpl)
    if (claims) {
      return { method: 'access', subject: String(claims.email ?? claims.common_name ?? claims.sub ?? 'access') }
    }
    throw new ApiError('unauthorized', 'Invalid Cloudflare Access assertion.')
  }

  const token = bearerToken(request)
  if (token && cfg.adminToken.length >= MIN_ADMIN_TOKEN_LENGTH && (await timingSafeEqualStr(token, cfg.adminToken))) {
    return { method: 'token', subject: 'admin-token' }
  }
  throw new ApiError('unauthorized', 'Admin authentication required.')
}

// ---------------------------------------------------------------- Cloudflare Access JWT

interface Jwk {
  kid?: string
  kty: string
  n?: string
  e?: string
  alg?: string
}

interface CachedKeys {
  fetchedAt: number
  keys: Map<string, CryptoKey>
}

const JWKS_TTL_MS = 10 * 60_000
const JWKS_MIN_REFRESH_MS = 30_000
const jwksCache = new Map<string, CachedKeys>()

/** For tests. */
export function clearJwksCache(): void {
  jwksCache.clear()
}

async function loadKeys(team: string, now: number, fetchImpl: FetchLike, force: boolean): Promise<Map<string, CryptoKey>> {
  const cached = jwksCache.get(team)
  if (cached && !force && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys
  if (cached && force && now - cached.fetchedAt < JWKS_MIN_REFRESH_MS) return cached.keys

  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new ApiError('unauthorized', 'Could not verify Cloudflare Access assertion.')
  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || !jwk.kid || !jwk.n || !jwk.e) continue
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    keys.set(jwk.kid, key)
  }
  jwksCache.set(team, { fetchedAt: now, keys })
  return keys
}

/** Returns the JWT claims when valid, otherwise null. */
export async function verifyAccessJwt(
  jwt: string,
  teamDomain: string,
  aud: string,
  now: number,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const [h, p, s] = parts as [string, string, string]
    const dec = new TextDecoder()
    const header = JSON.parse(dec.decode(base64urlDecode(h))) as { alg?: string; kid?: string }
    const claims = JSON.parse(dec.decode(base64urlDecode(p))) as Record<string, unknown>
    if (header.alg !== 'RS256' || !header.kid) return null

    let keys = await loadKeys(teamDomain, now, fetchImpl, false)
    let key = keys.get(header.kid)
    if (!key) {
      keys = await loadKeys(teamDomain, now, fetchImpl, true)
      key = keys.get(header.kid)
    }
    if (!key) return null

    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64urlDecode(s),
      new TextEncoder().encode(`${h}.${p}`),
    )
    if (!ok) return null

    const nowSec = Math.floor(now / 1000)
    const leeway = 60
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!auds.includes(aud)) return null
    if (claims.iss !== `https://${teamDomain}`) return null
    if (typeof claims.exp !== 'number' || claims.exp + leeway < nowSec) return null
    if (typeof claims.nbf === 'number' && claims.nbf - leeway > nowSec) return null
    return claims
  } catch (err) {
    if (err instanceof ApiError) throw err
    return null
  }
}
