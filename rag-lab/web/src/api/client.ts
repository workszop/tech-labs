/**
 * Client for the RAG Lab Cloudflare Worker.
 *
 * Security notes
 * - The session token lives in this module's memory only: not in localStorage,
 *   sessionStorage, cookies or URLs. Reloading the page therefore asks for the
 *   access code again (your local vector index is kept).
 * - The browser never talks to the model provider directly and never sees a
 *   provider API key; it can only call these fixed Worker endpoints.
 */
import type {
  ActivateResponse,
  ApiErrorBody,
  ApiErrorCode,
  ChatRequest,
  ChatResponse,
  ChatUsage,
  EmbeddingsResponse,
  PromptEcho,
  SessionInfo,
  UsageInfo,
} from '@shared/api-types'
import { getLang, t } from '@/i18n'
import { parseSse } from './sse'

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
  const byCode: Partial<Record<ApiError['code'], string>> = t().lab.errors.byCode
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
  return new ApiError(code, message ?? t().lab.errors.requestFailed(res.status), res.status, body?.error?.retryAfterSeconds)
}

async function request(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (init.auth !== false) {
    if (!sessionToken) throw new ApiError('unauthorized', t().lab.errors.activateFirst, 401)
    headers.set('Authorization', `Bearer ${sessionToken}`)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'omit', cache: 'no-store' })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new ApiError('aborted', t().lab.errors.byCode.aborted)
    throw new ApiError('network', t().lab.errors.byCode.network)
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
      throw new ApiError('upstream_bad_response', t().lab.errors.embeddingMalformed)
    }
    return data
  },
  async chat(
    req: ChatRequest,
    handlers: { onPrompt?: (p: PromptEcho) => void; onDelta?: (t: string) => void },
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const res = await request('/api/chat', { method: 'POST', body: JSON.stringify(req), signal })
    if (req.stream === false || !res.headers.get('Content-Type')?.includes('text/event-stream')) {
      const data = (await res.json()) as ChatResponse
      handlers.onPrompt?.(data.prompt)
      handlers.onDelta?.(data.answer)
      return data
    }
    if (!res.body) throw new ApiError('upstream_bad_response', t().lab.errors.emptyStream)
    let prompt: PromptEcho | null = null
    let answer = ''
    try {
      for await (const ev of parseSse(res.body, signal)) {
        const payload = JSON.parse(ev.data)
        if (ev.event === 'prompt') {
          prompt = payload as PromptEcho
          handlers.onPrompt?.(prompt)
        } else if (ev.event === 'delta') {
          answer += payload.text
          handlers.onDelta?.(payload.text)
        } else if (ev.event === 'done') {
          const d = payload as { finishReason: string | null; usage: ChatUsage; durationMs: number; quota: UsageInfo }
          if (!prompt) throw new ApiError('upstream_bad_response', t().lab.errors.streamNoPrompt)
          return { prompt, answer, finishReason: d.finishReason, usage: d.usage, durationMs: d.durationMs, quota: d.quota }
        } else if (ev.event === 'error') {
          const code = (payload.code ?? 'internal') as ApiErrorCode
          throw new ApiError(code, (payload.code ? localizedErrorMessage(code, payload.message) : payload.message) ?? t().lab.errors.generationFailed, 0, payload.retryAfterSeconds)
        }
      }
    } catch (e) {
      if (e instanceof ApiError) throw e
      if ((e as Error)?.name === 'AbortError' || signal?.aborted) throw new ApiError('aborted', t().lab.errors.byCode.aborted)
      if (e instanceof SyntaxError) throw new ApiError('upstream_bad_response', t().lab.errors.streamMalformed)
      throw new ApiError('network', t().lab.errors.streamInterrupted)
    }
    throw new ApiError('network', t().lab.errors.streamClosed)
  },
}

/** Test hook. */
export function __setTokenForTests(t: string | null) {
  sessionToken = t
}
