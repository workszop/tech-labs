/**
 * CORS for the cross-site browser app. CORS is NOT authentication: requests
 * without an Origin header (curl, admin CLI) pass through and still need auth.
 */
import type { Config } from './env'
import { ApiError } from './http'

const ALLOW_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'
const ALLOW_HEADERS = 'Authorization, Content-Type'
const EXPOSE_HEADERS = 'Retry-After'

export type CorsDecision = { kind: 'none' } | { kind: 'allowed'; origin: string } | { kind: 'denied' }

export function corsDecision(request: Request, cfg: Config): CorsDecision {
  const origin = request.headers.get('Origin')
  if (origin === null) return { kind: 'none' }
  return cfg.allowedOrigins.has(origin) ? { kind: 'allowed', origin } : { kind: 'denied' }
}

export function preflight(decision: CorsDecision): Response {
  const headers = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' })
  if (decision.kind === 'allowed') {
    headers.set('Access-Control-Allow-Origin', decision.origin)
    headers.set('Access-Control-Allow-Methods', ALLOW_METHODS)
    headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS)
    headers.set('Access-Control-Max-Age', '86400')
  }
  return new Response(null, { status: 204, headers })
}

export function deniedError(): ApiError {
  return new ApiError('origin_not_allowed', 'This website is not allowed to use the Service Agent Lab API.')
}

/** Adds CORS headers to a response (always `Vary: Origin`). */
export function withCors(res: Response, decision: CorsDecision): Response {
  const headers = new Headers(res.headers)
  const vary = headers.get('Vary')
  if (!vary || !/\borigin\b/i.test(vary)) headers.set('Vary', vary ? `${vary}, Origin` : 'Origin')
  if (decision.kind === 'allowed') {
    headers.set('Access-Control-Allow-Origin', decision.origin)
    headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS)
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
