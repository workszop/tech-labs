/**
 * OpenAI-compatible provider (`/embeddings`, `/chat/completions`).
 *
 * Upstream error bodies are NEVER forwarded to the client (they can echo
 * request data or account details). Only a sanitized summary is logged:
 * operation, HTTP status, and the upstream error `type`/`code` if short.
 */
import type { ChatMessage } from '../../../shared/api-types'
import { ApiError } from '../http'
import { parseSse } from './sse'
import type { ChatOptions, ChatResult, ChatStreamChunk, EmbedResult, Provider, TokenUsage } from './types'

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

  private chatBody(messages: ChatMessage[], opts: ChatOptions, stream: boolean): string {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }
    if (stream) {
      body.stream = true
      body.stream_options = { include_usage: true }
    }
    return JSON.stringify(body)
  }

  async chat(messages: ChatMessage[], opts: ChatOptions, signal?: AbortSignal): Promise<ChatResult> {
    const op = 'chat'
    this.requireKey(op)
    const d = deadline(this.opts.chatTimeoutMs, signal)
    try {
      let body: unknown
      try {
        const res = await this.fetchImpl(`${this.opts.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers(),
          body: this.chatBody(messages, opts, false),
          signal: d.signal,
        })
        if (!res.ok) throw await upstreamHttpError(op, res)
        body = await res.json().catch(() => {
          throw badResponse(op, 'invalid json')
        })
      } catch (err) {
        throw transportError(op, err, d)
      }
      const choice = (body as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }> })?.choices?.[0]
      const content = choice?.message?.content
      if (typeof content !== 'string') throw badResponse(op, 'missing content')
      return {
        text: content,
        finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
        usage: parseUsage((body as { usage?: unknown }).usage),
      }
    } finally {
      d.clear()
    }
  }

  async *chatStream(messages: ChatMessage[], opts: ChatOptions, signal?: AbortSignal): AsyncGenerator<ChatStreamChunk> {
    const op = 'chat_stream'
    this.requireKey(op)
    const d = deadline(this.opts.chatTimeoutMs, signal)
    let res: Response
    try {
      try {
        res = await this.fetchImpl(`${this.opts.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { ...this.headers(), Accept: 'text/event-stream' },
          body: this.chatBody(messages, opts, true),
          signal: d.signal,
        })
        if (!res.ok) throw await upstreamHttpError(op, res)
        if (!res.body) throw badResponse(op, 'no body')
      } catch (err) {
        throw transportError(op, err, d)
      }

      let finishReason: string | null = null
      let usage: TokenUsage | null = null
      let sawDone = false
      let sawAny = false
      const iter = parseSse(res.body)
      try {
        for (;;) {
          let next: IteratorResult<{ event: string; data: string }>
          try {
            next = await iter.next()
          } catch (err) {
            throw transportError(op, err, d)
          }
          if (next.done) break
          const { data } = next.value
          if (data.trim() === '[DONE]') {
            sawDone = true
            break
          }
          let j: Record<string, unknown>
          try {
            j = JSON.parse(data) as Record<string, unknown>
          } catch {
            throw badResponse(op, 'invalid json chunk')
          }
          if (j.error) {
            logUpstream(op, { error: 'stream_error_event' })
            throw new ApiError('upstream_unavailable', 'The AI provider reported an error while answering.')
          }
          const u = parseUsage(j.usage)
          if (u) usage = u
          const choices = j.choices
          if (Array.isArray(choices) && choices.length) {
            const c = choices[0] as { delta?: { content?: unknown }; finish_reason?: unknown }
            const text = c?.delta?.content
            if (typeof text === 'string' && text.length) {
              sawAny = true
              yield { type: 'delta', text }
            }
            if (typeof c?.finish_reason === 'string') finishReason = c.finish_reason
          }
        }
      } finally {
        await iter.return(undefined).catch(() => {})
        if (!sawDone) await res.body.cancel().catch(() => {})
      }
      if (!sawDone && finishReason === null && !sawAny) throw badResponse(op, 'stream ended early')
      yield { type: 'finish', finishReason, usage }
    } finally {
      d.clear()
    }
  }
}
