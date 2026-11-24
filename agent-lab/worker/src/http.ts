import type { ApiErrorBody, ApiErrorCode } from '../../shared/api-types'

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  invalid_code: 401,
  expired_code: 403,
  revoked_code: 403,
  too_many_sessions: 403,
  unauthorized: 401,
  session_expired: 401,
  quota_exceeded: 402,
  rate_limited: 429,
  payload_too_large: 413,
  origin_not_allowed: 403,
  model_not_allowed: 400,
  upstream_unavailable: 502,
  upstream_timeout: 504,
  upstream_bad_response: 502,
  run_limit_exceeded: 409,
  not_found: 404,
  internal: 500,
}

/** An error whose message is safe to show to the participant. */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly retryAfterSeconds?: number
  constructor(code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
  get status(): number {
    return ERROR_STATUS[this.code]
  }
  toBody(): ApiErrorBody {
    const error: ApiErrorBody['error'] = { code: this.code, message: this.message }
    if (this.retryAfterSeconds !== undefined) error.retryAfterSeconds = this.retryAfterSeconds
    return { error }
  }
}

/** Converts anything thrown into a safe ApiError (unknown errors become `internal`, details are logged only). */
export function toApiError(err: unknown, where = 'request'): ApiError {
  if (err instanceof ApiError) return err
  console.error(
    JSON.stringify({ level: 'error', where, error: err instanceof Error ? err.name : typeof err, message: err instanceof Error ? truncate(err.message, 300) : undefined }),
  )
  return new ApiError('internal', 'Unexpected server error.')
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const BASE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...headers },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: { ...BASE_HEADERS } })
}

export function errorResponse(err: ApiError): Response {
  const headers: Record<string, string> = {}
  if (err.retryAfterSeconds !== undefined) headers['Retry-After'] = String(err.retryAfterSeconds)
  return json(err.toBody(), err.status, headers)
}

/**
 * Reads a JSON body with a hard byte limit (checks Content-Length up front and
 * counts streamed bytes, so a lying/absent Content-Length cannot bypass it).
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const ct = request.headers.get('Content-Type') ?? ''
  if (!/^application\/json\b/i.test(ct.trim())) {
    throw new ApiError('invalid_request', 'Content-Type must be application/json.')
  }
  const declared = request.headers.get('Content-Length')
  if (declared !== null && Number(declared) > maxBytes) {
    throw new ApiError('payload_too_large', `Request body is larger than ${maxBytes} bytes.`)
  }
  if (!request.body) throw new ApiError('invalid_request', 'Request body is required.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new ApiError('payload_too_large', `Request body is larger than ${maxBytes} bytes.`)
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.byteLength
  }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf)
  } catch {
    throw new ApiError('invalid_request', 'Request body must be valid UTF-8.')
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('invalid_request', 'Request body must be valid JSON.')
  }
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function iso(ms: number | null | undefined): string | null {
  return ms === null || ms === undefined ? null : new Date(ms).toISOString()
}
