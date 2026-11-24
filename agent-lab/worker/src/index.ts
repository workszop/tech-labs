/**
 * Service Agent Lab API gateway — the only server-side component of Service Agent Lab.
 * Routes: see README.md. Contract: ../../shared/api-types.ts
 */
import type { RequestContext } from './context'
import { corsDecision, deniedError, preflight, withCors } from './cors'
import { type Env, loadConfig } from './env'
import { ApiError, errorResponse, toApiError } from './http'
import type { FetchLike } from './providers/openai-compatible'
import { handleCreateCodes, handleListCodes, handleRevokeCode, handleUpdateCode } from './routes/admin'
import { handleActivate } from './routes/activate'
import { handleChat } from './routes/chat'
import { handleEmbeddings } from './routes/embeddings'
import { handleHealth } from './routes/health'
import { handleLogout, handleSession, handleUsage } from './routes/session'
import { runCleanup } from './scheduled'

export type { Env } from './env'

type Handler = (c: RequestContext) => Promise<Response>

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
}

function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' + path.replace(/:([a-zA-Z]+)/g, (_, k: string) => (keys.push(k), '([A-Za-z0-9_-]{1,64})')) + '/?$',
  )
  return { method, pattern, keys, handler }
}

const ROUTES: Route[] = [
  route('GET', '/api/health', handleHealth),
  route('POST', '/api/activate', handleActivate),
  route('GET', '/api/session', handleSession),
  route('POST', '/api/logout', handleLogout),
  route('GET', '/api/usage', handleUsage),
  route('POST', '/api/embeddings', handleEmbeddings),
  route('POST', '/api/chat', handleChat),
  route('POST', '/api/admin/codes', handleCreateCodes),
  route('GET', '/api/admin/codes', handleListCodes),
  route('PATCH', '/api/admin/codes/:id', handleUpdateCode),
  route('DELETE', '/api/admin/codes/:id', handleRevokeCode),
]

/** Query parameters that must never carry credentials. */
const FORBIDDEN_QUERY = ['token', 'access_token', 'session', 'code', 'key', 'api_key']

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  opts: { fetch?: FetchLike } = {},
): Promise<Response> {
  const now = Date.now()
  let cfg
  try {
    cfg = loadConfig(env)
  } catch (err) {
    return errorResponse(toApiError(err, 'config'))
  }
  const cors = corsDecision(request, cfg)

  if (request.method === 'OPTIONS') {
    if (cors.kind === 'denied') return withCors(errorResponse(deniedError()), cors)
    return preflight(cors)
  }

  let res: Response
  try {
    if (cors.kind === 'denied') throw deniedError()
    const url = new URL(request.url)
    for (const k of FORBIDDEN_QUERY) {
      if (url.searchParams.has(k)) throw new ApiError('invalid_request', 'Credentials must be sent in the Authorization header, never in the URL.')
    }
    let matched: { r: Route; params: Record<string, string> } | null = null
    let pathMatched = false
    for (const r of ROUTES) {
      const m = r.pattern.exec(url.pathname)
      if (!m) continue
      pathMatched = true
      if (r.method !== request.method && !(r.method === 'GET' && request.method === 'HEAD')) continue
      const params: Record<string, string> = {}
      r.keys.forEach((k, i) => (params[k] = m[i + 1]!))
      matched = { r, params }
      break
    }
    if (!matched) throw new ApiError('not_found', pathMatched ? 'Method not supported for this endpoint.' : 'Not found.')
    res = await matched.r.handler({ request, env, cfg, ctx, url, params: matched.params, now, fetch: opts.fetch })
  } catch (err) {
    res = errorResponse(toApiError(err, 'router'))
  }
  return withCors(res, cors)
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx)
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runCleanup(env))
  },
} satisfies ExportedHandler<Env>
