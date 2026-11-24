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
  AgentRequest,
  AgentResponse,
  ApiErrorBody,
  ApiErrorCode,
  EmbeddingsResponse,
  Lang,
  SessionInfo,
  UsageInfo,
} from '@shared/api-types'
import { getLang, t } from '@/i18n'

/** The local Worker of `npm run dev`; not even present in a production bundle. */
const DEV_API_BASE_URL: string | null = import.meta.env.DEV ? 'http://localhost:8787' : null

/**
 * The Worker's URL: `VITE_API_BASE_URL`, or the local Worker in development.
 * A production build without the variable has no server (null): it sends
 * nothing and the activation screen says the lab is not configured yet, instead
 * of sending a visitor's access code to their own machine.
 */
export function resolveApiBaseUrl(configured: string | undefined, dev: boolean): string | null {
  const url = configured?.trim().replace(/\/+$/, '')
  return url || (dev ? DEV_API_BASE_URL : null)
}

let apiBaseUrl: string | null = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined, !!import.meta.env.DEV)

/** The Worker's URL, or null when this build has none configured. */
export function getApiBaseUrl(): string | null {
  return apiBaseUrl
}

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
    public readonly code: ApiErrorCode | 'network' | 'aborted' | 'not_configured',
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
  if (!apiBaseUrl) throw new ApiError('not_configured', t().shell.errors.byCode.not_configured)
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.auth !== false) {
    if (!sessionToken) throw new ApiError('unauthorized', t().shell.errors.activateFirst, 401)
    headers.set('Authorization', `Bearer ${sessionToken}`)
  }
  let res: Response
  try {
    res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: 'omit', cache: 'no-store' })
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
  /**
   * Best-effort logout while the page is being unloaded (reload, tab closed), so
   * the session slot of the code is freed at once. `keepalive` lets the request
   * outlive the page; the token goes in the Authorization header, never in a URL.
   */
  logoutOnUnload(): void {
    const token = sessionToken
    sessionToken = null
    if (!token || !apiBaseUrl) return
    try {
      void fetch(`${apiBaseUrl}/api/logout`, { method: 'POST', keepalive: true, credentials: 'omit', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined)
    } catch {
      /* the page is going away: nothing to report */
    }
  },
  /** `lang` is the language of the inputs (default: the UI language); only the offline mock model uses it. */
  async embed(inputs: string[], signal?: AbortSignal, lang: Lang = getLang()): Promise<EmbeddingsResponse> {
    const res = await request('/api/embeddings', { method: 'POST', body: JSON.stringify({ inputs, lang }), signal })
    const data = (await res.json()) as EmbeddingsResponse
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length || data.embeddings.some((v) => !Array.isArray(v) || v.length !== data.dimensions)) {
      throw new ApiError('upstream_bad_response', t().shell.errors.embeddingMalformed)
    }
    return data
  },
  /** One model turn of an agent run (POST /api/agent). */
  async agentStep(req: AgentRequest, signal?: AbortSignal): Promise<AgentResponse> {
    const res = await request('/api/agent', { method: 'POST', body: JSON.stringify(req), signal })
    const data = (await res.json()) as AgentResponse
    if (!isAgentResponse(data, req.runId)) throw new ApiError('upstream_bad_response', t().shell.errors.agentMalformed)
    return data
  },
}

/** Shape check of the fields the agent loop relies on. */
function isAgentResponse(d: unknown, runId: string): d is AgentResponse {
  const r = d as Partial<AgentResponse> | null
  return (
    !!r &&
    r.runId === runId.toLowerCase() &&
    (r.kind === 'tool_calls' || r.kind === 'final') &&
    !!r.assistantMessage &&
    typeof r.assistantMessage.content === 'string' &&
    (r.assistantMessage.toolCalls === undefined || Array.isArray(r.assistantMessage.toolCalls)) &&
    Array.isArray(r.toolCalls) &&
    Array.isArray(r.rejected) &&
    typeof r.forcedFinal === 'boolean' &&
    !!r.usage &&
    !!r.limits
  )
}

/** Test hook. */
export function __setTokenForTests(t: string | null) {
  sessionToken = t
}

/** Test hook. */
export function __setApiBaseForTests(url: string | null) {
  apiBaseUrl = url
}
