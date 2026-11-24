/**
 * OpenAI-compatible provider (`/embeddings`, `/chat/completions`).
 *
 * Upstream error bodies are NEVER forwarded to the client (they can echo
 * request data or account details). Only a sanitized summary is logged:
 * operation, HTTP status, and the upstream error `type`/`code` if short.
 */
import type { AgentMessage } from '../../../shared/api-types'
import type { ToolDef } from '../../../shared/tools'
import { ApiError } from '../http'
import type { ChatOptions, EmbedResult, Provider, TokenUsage, ToolChatResult, UpstreamToolCall } from './types'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface OpenAICompatibleOptions {
  baseUrl: string
  apiKey: string
  embeddingModel: string
  chatModel: string
  embeddingDimensions: number
  embedTimeoutMs: number
  chatTimeoutMs: number
  fetch?: FetchLike
}

interface Deadline {
  signal: AbortSignal
  timedOut: () => boolean
  clear: () => void
}

/** Combines the caller's signal (client disconnect) with a timeout. */
function deadline(ms: number, outer?: AbortSignal): Deadline {
  const ctl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctl.abort(new Error('timeout'))
  }, ms)
  const onAbort = () => ctl.abort(outer?.reason)
  if (outer) {
    if (outer.aborted) ctl.abort(outer.reason)
    else outer.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctl.signal,
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onAbort)
    },
  }
}

function logUpstream(op: string, info: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: 'warn', component: 'provider', provider: 'openai-compatible', op, ...info }))
}

async function summarizeErrorBody(res: Response): Promise<string | undefined> {
  try {
    const text = (await res.text()).slice(0, 4096)
    const j = JSON.parse(text) as { error?: { type?: unknown; code?: unknown } }
    const t = j?.error?.code ?? j?.error?.type
    return typeof t === 'string' && /^[\w.-]{1,64}$/.test(t) ? t : undefined
  } catch {
    return undefined
  }
}

async function upstreamHttpError(op: string, res: Response): Promise<ApiError> {
  const kind = await summarizeErrorBody(res)
  logUpstream(op, { status: res.status, upstreamError: kind })
  if (res.status === 429) {
    return new ApiError('upstream_unavailable', 'The AI provider is rate limiting requests right now. Please try again in a moment.')
  }
  if (res.status === 401 || res.status === 403) {
    return new ApiError('upstream_unavailable', 'The AI provider rejected the server credentials. Please tell the workshop organiser.')
  }
  if (res.status >= 500) return new ApiError('upstream_unavailable', 'The AI provider is unavailable. Please try again later.')
  return new ApiError('upstream_unavailable', `The AI provider could not process the request (HTTP ${res.status}).`)
}

function transportError(op: string, err: unknown, d: Deadline): ApiError {
  if (err instanceof ApiError) return err
  if (d.timedOut()) {
    logUpstream(op, { error: 'timeout' })
    return new ApiError('upstream_timeout', 'The AI provider took too long to answer.')
  }
  if (d.signal.aborted) {
    return new ApiError('upstream_unavailable', 'The request was cancelled.')
  }
  logUpstream(op, { error: err instanceof Error ? err.name : 'network' })
  return new ApiError('upstream_unavailable', 'Could not reach the AI provider.')
}

function badResponse(op: string, why: string): ApiError {
  logUpstream(op, { error: 'bad_response', why })
  return new ApiError('upstream_bad_response', 'The AI provider returned an unexpected response.')
}

function parseUsage(u: unknown): TokenUsage | null {
  if (!u || typeof u !== 'object') return null
  const o = u as Record<string, unknown>
  const inT = o.prompt_tokens
  const outT = o.completion_tokens ?? 0
  if (typeof inT !== 'number' || typeof outT !== 'number' || !Number.isFinite(inT) || !Number.isFinite(outT)) return null
  return { inputTokens: Math.max(0, Math.round(inT)), outputTokens: Math.max(0, Math.round(outT)) }
}

export class OpenAICompatibleProvider implements Provider {
  readonly name = 'openai-compatible' as const
  readonly embeddingModel: string
  readonly chatModel: string
  readonly embeddingDimensions: number
  private readonly opts: OpenAICompatibleOptions
  private readonly fetchImpl: FetchLike

  constructor(opts: OpenAICompatibleOptions) {
    this.opts = opts
    this.embeddingModel = opts.embeddingModel
    this.chatModel = opts.chatModel
    this.embeddingDimensions = opts.embeddingDimensions
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json' }
  }

  private requireKey(op: string): void {
    if (!this.opts.apiKey) {
      logUpstream(op, { error: 'missing_api_key' })
      throw new ApiError('upstream_unavailable', 'The AI provider is not configured on the server.')
    }
  }

  async embed(inputs: string[], signal?: AbortSignal): Promise<EmbedResult> {
    const op = 'embeddings'
    this.requireKey(op)
    const d = deadline(this.opts.embedTimeoutMs, signal)
    try {
      let res: Response
      let body: unknown
      try {
        res = await this.fetchImpl(`${this.opts.baseUrl}/embeddings`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: this.embeddingModel, input: inputs, encoding_format: 'float' }),
          signal: d.signal,
        })
        if (!res.ok) throw await upstreamHttpError(op, res)
        body = await res.json().catch(() => {
          throw badResponse(op, 'invalid json')
        })
      } catch (err) {
        throw transportError(op, err, d)
      }

      const data = (body as { data?: unknown })?.data
      if (!Array.isArray(data) || data.length !== inputs.length) throw badResponse(op, 'data length mismatch')
      const out: (number[] | undefined)[] = new Array(inputs.length)
      for (const item of data as Array<{ index?: unknown; embedding?: unknown }>) {
        const idx = item?.index
        const vec = item?.embedding
        if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= inputs.length || out[idx]) {
          throw badResponse(op, 'bad index')
        }
        if (!Array.isArray(vec) || vec.length !== this.embeddingDimensions) throw badResponse(op, 'bad dimensions')
        for (const x of vec) if (typeof x !== 'number' || !Number.isFinite(x)) throw badResponse(op, 'non-numeric vector')
        out[idx] = vec as number[]
      }
      const usage = (body as { usage?: { prompt_tokens?: unknown } }).usage
      const inputTokens = typeof usage?.prompt_tokens === 'number' ? Math.round(usage.prompt_tokens) : null
      return {
        model: this.embeddingModel,
        embeddings: out as number[][],
        inputTokens,
      }
    } finally {
      d.clear()
    }
  }

  async chatWithTools(
    system: string,
    messages: AgentMessage[],
    tools: ToolDef[],
    opts: ChatOptions & { toolChoice: 'auto' | 'none' },
    signal?: AbortSignal,
  ): Promise<ToolChatResult> {
    const op = 'chat_tools'
    this.requireKey(op)
    const d = deadline(this.opts.chatTimeoutMs, signal)
    try {
      let body: unknown
      try {
        const res = await this.fetchImpl(`${this.opts.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(toolChatBody(system, messages, tools, opts)),
          signal: d.signal,
        })
        if (!res.ok) throw await upstreamHttpError(op, res)
        body = await res.json().catch(() => {
          throw badResponse(op, 'invalid json')
        })
      } catch (err) {
        throw transportError(op, err, d)
      }
      const choice = (body as { choices?: Array<{ message?: unknown; finish_reason?: unknown }> })?.choices?.[0]
      const message = choice?.message as { content?: unknown; tool_calls?: unknown } | undefined
      if (!message || typeof message !== 'object') throw badResponse(op, 'missing message')
      const content = message.content
      if (content !== undefined && content !== null && typeof content !== 'string') throw badResponse(op, 'bad content')
      const rawCalls = message.tool_calls
      if (rawCalls !== undefined && rawCalls !== null && !Array.isArray(rawCalls)) throw badResponse(op, 'bad tool_calls')
      return {
        text: typeof content === 'string' ? content : '',
        toolCalls: parseToolCalls(Array.isArray(rawCalls) ? rawCalls : []),
        finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
        usage: parseUsage((body as { usage?: unknown }).usage),
      }
    } finally {
      d.clear()
    }
  }
}

/** OpenAI chat-completions body. A forced-final turn sends no tools, tool_choice or parallel_tool_calls at all. */
export function toolChatBody(
  system: string,
  messages: AgentMessage[],
  tools: ToolDef[],
  opts: ChatOptions & { toolChoice: 'auto' | 'none' },
): Record<string, unknown> {
  const upstream: Record<string, unknown>[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') upstream.push({ role: 'user', content: m.content })
    else if (m.role === 'tool') upstream.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content })
    else if (m.toolCalls?.length) {
      upstream.push({
        role: 'assistant',
        content: m.content === '' ? null : m.content,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        })),
      })
    } else upstream.push({ role: 'assistant', content: m.content })
  }
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: upstream,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  }
  if (opts.toolChoice === 'auto' && tools.length) {
    body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
    body.tool_choice = 'auto'
    body.parallel_tool_calls = true
  }
  return body
}

/**
 * Normalises upstream tool calls. Arguments stay a raw string (they may be
 * malformed; the route reports that to the model). Missing or repeated IDs are
 * replaced, because some compatible servers omit them.
 */
function parseToolCalls(raw: unknown[]): UpstreamToolCall[] {
  const seen = new Set<string>()
  return raw.map((item) => {
    const c = (item && typeof item === 'object' ? item : {}) as { id?: unknown; function?: { name?: unknown; arguments?: unknown } }
    const fn = c.function && typeof c.function === 'object' ? c.function : {}
    let id = typeof c.id === 'string' && /^[\w.:-]{1,100}$/.test(c.id) ? c.id : ''
    if (!id || seen.has(id)) id = `call_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    seen.add(id)
    const args = fn.arguments
    return {
      id,
      name: typeof fn.name === 'string' ? fn.name.slice(0, 100) : '',
      rawArguments: typeof args === 'string' ? args : args && typeof args === 'object' ? JSON.stringify(args) : '',
    }
  })
}
