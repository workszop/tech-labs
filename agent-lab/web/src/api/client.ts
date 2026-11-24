/**
 * Client for the Service Agent Lab Cloudflare Worker.
 *
 * Security notes
 * - The session token lives in this module's memory only: not in localStorage,
 *   sessionStorage, cookies or URLs. Reloading the page therefore asks for the
 *   access code again (nothing is stored on the server).
 * - The browser never talks to the model provider directly and never sees a
 *   provider API key; it can only call these fixed Worker endpoints.
 */
import type {
  ActivateResponse,
  ApiErrorBody,
  ApiErrorCode,
  EmbeddingsResponse,
  SessionInfo,
  UsageInfo,
} from '@shared/api-types'
import { getLang, t } from '@/i18n'

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8787'

let sessionToken: string | null = null
type Listener = (err: ApiError) => void
const authListeners = new Set<Listener>()

export function onAuthLost(fn: Listener) {
  authListeners.add(fn)
  return () => authListeners.delete(fn)
}
export function hasSession() {
  return sessionToken !== null
}

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode | 'network' | 'aborted',
    message: string,
    public readonly status = 0,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get isAuthError() {
    return this.code === 'unauthorized' || this.code === 'session_expired' || this.code === 'revoked_code' || this.code === 'expired_code'
  }
}

/**
 * Text shown to the user for an error. The Worker answers with English messages:
 * in English its (more specific) message wins and the dictionary is the fallback;
 * in Polish the dictionary text for the error code wins and the server message is the fallback.
 */
export function localizedErrorMessage(code: ApiError['code'], serverMessage?: string | null): string | undefined {
  const byCode: Partial<Record<ApiError['code'], string>> = t().shell.errors.byCode
  const known = byCode[code]
  return getLang() === 'en' ? serverMessage || known : known || serverMessage || undefined
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null
  try {
    body = (await res.json()) as ApiErrorBody
  } catch {
    /* not JSON */
  }
  const code = (body?.error?.code ?? (res.status === 401 ? 'unauthorized' : 'internal')) as ApiErrorCode
  // Without a JSON error body the code above is only a guess, so say what is certain: the HTTP status.
  const message = body?.error ? localizedErrorMessage(code, body.error.message) : undefined
  return new ApiError(code, message ?? t().shell.errors.requestFailed(res.status), res.status, body?.error?.retryAfterSeconds)
}

async function request(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.auth !== false) {
    if (!sessionToken) throw new ApiError('unauthorized', t().shell.errors.activateFirst, 401)
    headers.set('Authorization', `Bearer ${sessionToken}`)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'omit', cache: 'no-store' })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new ApiError('aborted', t().shell.errors.byCode.aborted)
    throw new ApiError('network', t().shell.errors.byCode.network)
  }
  if (!res.ok) {
    const err = await toApiError(res)
    if (err.isAuthError && init.auth !== false) {
      sessionToken = null
      authListeners.forEach((l) => l(err))
    }
    throw err
  }
  return res
}

export const api = {
  async activate(code: string): Promise<SessionInfo> {
    const res = await request('/api/activate', { method: 'POST', body: JSON.stringify({ code }), auth: false })
    const data = (await res.json()) as ActivateResponse
    sessionToken = data.token
    return data.session
  },
  async session(): Promise<SessionInfo> {
    return (await request('/api/session')).json()
  },
  async usage(): Promise<UsageInfo> {
    return (await request('/api/usage')).json()
  },
  async logout(): Promise<void> {
    try {
      if (sessionToken) await request('/api/logout', { method: 'POST' })
    } finally {
      sessionToken = null
    }
  },
  async embed(inputs: string[], signal?: AbortSignal): Promise<EmbeddingsResponse> {
    const res = await request('/api/embeddings', { method: 'POST', body: JSON.stringify({ inputs, lang: getLang() }), signal })
    const data = (await res.json()) as EmbeddingsResponse
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length || data.embeddings.some((v) => !Array.isArray(v) || v.length !== data.dimensions)) {
      throw new ApiError('upstream_bad_response', t().shell.errors.embeddingMalformed)
    }
    return data
  },
}

/** Test hook. */
export function __setTokenForTests(t: string | null) {
  sessionToken = t
}
