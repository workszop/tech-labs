/**
 * POST /api/chat — RAG / no-RAG answer generation.
 *
 * The upstream messages are ALWAYS built server-side with the shared
 * `buildChatMessages` (participants cannot replace the system prompt) and
 * echoed back verbatim as `PromptEcho`. The optional `lang` ("pl" | "en",
 * default "en") selects the language of that prompt template.
 *
 * Out-of-range numeric settings are CLAMPED (temperature → [0, 1],
 * maxTokens → [64, 1024], rounded); wrong types are `invalid_request`.
 * The echo shows the values actually used.
 */
import type { ChatMode, ChatResponse, ChatUsage, ContextChunk, Lang, PromptEcho, PromptProfile } from '../../../shared/api-types'
import { DEFAULT_PROMPT_LANG, MAX_INSTRUCTIONS_CHARS, buildChatMessages, estimateMessagesTokens, estimateTokens, isLang } from '../../../shared/prompt'
import { requireSession } from '../auth/session'
import { cost, type RequestContext } from '../context'
import { type AccessCodeRow, reserveQuota, settleUsage, usageInfo } from '../db'
import { ApiError, isObject, json, readJson, sseHeaders, toApiError } from '../http'
import { LIMITS, clamp } from '../limits'
import { createProvider } from '../providers'
import { sseEvent } from '../providers/sse'
import type { TokenUsage } from '../providers/types'
import { enforceSessionRateLimit } from '../ratelimit'
import { assertNoClientModel } from './embeddings'

export interface ValidatedChat {
  question: string
  context: ContextChunk[]
  mode: ChatMode
  lang: Lang
  profile: PromptProfile
  instructions: string
  temperature: number
  maxTokens: number
  stream: boolean
}

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw new ApiError('invalid_request', `\`${field}\` must be a string.`)
  if (v.length > max) throw new ApiError('payload_too_large', `\`${field}\` is longer than ${max} characters.`)
  return v
}

export function validateChat(body: unknown): ValidatedChat {
  if (!isObject(body)) throw new ApiError('invalid_request', 'Body must be a JSON object.')
  if (typeof body.question !== 'string') throw new ApiError('invalid_request', '`question` must be a string.')
  const question = body.question.trim()
  if (!question) throw new ApiError('invalid_request', '`question` must not be empty.')
  if (question.length > LIMITS.maxQuestionChars) {
    throw new ApiError('payload_too_large', `The question is longer than ${LIMITS.maxQuestionChars} characters.`)
  }
  if (body.mode !== 'rag' && body.mode !== 'no-rag') throw new ApiError('invalid_request', '`mode` must be "rag" or "no-rag".')
  const mode = body.mode
  let lang: Lang = DEFAULT_PROMPT_LANG
  if (body.lang !== undefined && body.lang !== null) {
    if (!isLang(body.lang)) throw new ApiError('invalid_request', '`lang` must be "pl" or "en".')
    lang = body.lang
  }

  let profile: PromptProfile = 'rybex'
  if (body.profile !== undefined && body.profile !== null) {
    if (body.profile !== 'rybex' && body.profile !== 'own') throw new ApiError('invalid_request', '`profile` must be "rybex" or "own".')
    profile = body.profile
  }
  let instructions = ''
  if (body.instructions !== undefined && body.instructions !== null) {
    if (profile !== 'own') throw new ApiError('invalid_request', '`instructions` need `profile: "own"`.')
    instructions = str(body.instructions, 'instructions', MAX_INSTRUCTIONS_CHARS)
  }

  const rawCtx = body.context ?? []
  if (!Array.isArray(rawCtx)) throw new ApiError('invalid_request', '`context` must be an array.')
  if (mode === 'no-rag' && rawCtx.length) throw new ApiError('invalid_request', '`context` must be empty in no-rag mode.')
  if (rawCtx.length > LIMITS.maxContextChunks) {
    throw new ApiError('payload_too_large', `At most ${LIMITS.maxContextChunks} context chunks per question.`)
  }
  const context: ContextChunk[] = rawCtx.map((ch, i) => {
    if (!isObject(ch)) throw new ApiError('invalid_request', `context[${i}] must be an object.`)
    return {
      chunkId: str(ch.chunkId, `context[${i}].chunkId`, LIMITS.maxChunkMetaChars),
      documentTitle: str(ch.documentTitle, `context[${i}].documentTitle`, LIMITS.maxChunkMetaChars),
      folder: str(ch.folder, `context[${i}].folder`, LIMITS.maxChunkMetaChars),
      text: str(ch.text, `context[${i}].text`, LIMITS.maxChatInputTokens * 4),
    }
  })

  // Profile 'own' only ever answers from excerpts: no RAG-less mode, no empty context (never a free chat).
  if (profile === 'own' && (mode !== 'rag' || context.length === 0)) {
    throw new ApiError('invalid_request', 'Profile "own" needs mode "rag" and at least one context chunk.')
  }

  let temperature: number = LIMITS.temperature.default
  if (body.temperature !== undefined && body.temperature !== null) {
    if (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature)) {
      throw new ApiError('invalid_request', '`temperature` must be a number.')
    }
    temperature = clamp(body.temperature, LIMITS.temperature)
  }
  let maxTokens: number = LIMITS.maxOutputTokens.default
  if (body.maxTokens !== undefined && body.maxTokens !== null) {
    if (typeof body.maxTokens !== 'number' || !Number.isFinite(body.maxTokens)) {
      throw new ApiError('invalid_request', '`maxTokens` must be a number.')
    }
    maxTokens = clamp(Math.round(body.maxTokens), LIMITS.maxOutputTokens)
  }
  let stream = true
  if (body.stream !== undefined) {
    if (typeof body.stream !== 'boolean') throw new ApiError('invalid_request', '`stream` must be a boolean.')
    stream = body.stream
  }
  return { question, context, mode, lang, profile, instructions, temperature, maxTokens, stream }
}

/** POST /api/chat */
export async function handleChat(c: RequestContext): Promise<Response> {
  const { session, code } = await requireSession(c.request, c.env.DB, c.cfg, c.now)
  await enforceSessionRateLimit(c, session.id)
  const body = await readJson(c.request, LIMITS.maxChatBodyBytes)
  const v = validateChat(body)
  const provider = createProvider(c.cfg, c.fetch)
  assertNoClientModel(body as Record<string, unknown>, provider.chatModel)

  const messages = buildChatMessages({ question: v.question, context: v.context, mode: v.mode, lang: v.lang, profile: v.profile, instructions: v.instructions })
  const inputEst = estimateMessagesTokens(messages)
  if (inputEst > LIMITS.maxChatInputTokens) {
    throw new ApiError(
      'payload_too_large',
      `The prompt is about ${inputEst} tokens; the limit is ${LIMITS.maxChatInputTokens}. Use fewer or smaller chunks.`,
    )
  }
  const echo: PromptEcho = { model: provider.chatModel, temperature: v.temperature, maxTokens: v.maxTokens, messages }
  const est = inputEst + v.maxTokens
  await reserveQuota(c.env.DB, code.id, est, c.now)

  const t0 = Date.now()
  const settle = (status: 'ok' | 'error' | 'aborted', usage: TokenUsage) =>
    settleUsage(
      c.env.DB,
      {
        accessCodeId: code.id,
        sessionId: session.id,
        model: provider.chatModel,
        operation: 'chat',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: cost(c.cfg, 'chat', usage.inputTokens, usage.outputTokens),
        status,
      },
      est,
      Date.now(),
    )
  const opts = { model: provider.chatModel, temperature: v.temperature, maxTokens: v.maxTokens }

  if (!v.stream) {
    try {
      const r = await provider.chat(messages, opts, c.request.signal)
      const usage: ChatUsage = r.usage ?? { inputTokens: inputEst, outputTokens: estimateTokens(r.text) }
      const settled = await settle('ok', usage)
      const res: ChatResponse = {
        prompt: echo,
        answer: r.text,
        finishReason: r.finishReason,
        usage,
        durationMs: Date.now() - t0,
        quota: usageInfo(settled ?? code),
      }
      return json(res)
    } catch (err) {
      const apiErr = toApiError(err, 'chat')
      await settle('error', { inputTokens: 0, outputTokens: 0 }).catch((e) => toApiError(e, 'chat.refund'))
      throw apiErr
    }
  }

  // ---------------------------------------------------------------- streaming
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  const upstreamAbort = new AbortController()
  let clientGone = false
  const onClientAbort = () => {
    clientGone = true
    upstreamAbort.abort()
  }
  c.request.signal?.addEventListener('abort', onClientAbort, { once: true })

  const send = async (type: string, data: unknown) => {
    if (clientGone) return
    try {
      await writer.write(enc.encode(sseEvent(type, data)))
    } catch {
      onClientAbort()
    }
  }

  const pump = async () => {
    let text = ''
    let lastQuota: AccessCodeRow = code
    try {
      await send('prompt', echo)
      let finishReason: string | null = null
      let reported: TokenUsage | null = null
      for await (const ch of provider.chatStream(messages, opts, upstreamAbort.signal)) {
        if (ch.type === 'delta') {
          text += ch.text
          await send('delta', { text: ch.text })
          if (clientGone) break
        } else {
          finishReason = ch.finishReason
          reported = ch.usage
        }
      }
      const usage: ChatUsage = reported ?? { inputTokens: inputEst, outputTokens: estimateTokens(text) }
      if (clientGone) {
        await settle('aborted', { inputTokens: inputEst, outputTokens: estimateTokens(text) })
        return
      }
      lastQuota = (await settle('ok', usage)) ?? lastQuota
      await send('done', { finishReason, usage, durationMs: Date.now() - t0, quota: usageInfo(lastQuota) })
    } catch (err) {
      const apiErr = clientGone ? new ApiError('upstream_unavailable', 'The request was cancelled.') : toApiError(err, 'chat.stream')
      // Tokens already streamed were really consumed upstream; otherwise refund the reservation.
      const partial = text ? { inputTokens: inputEst, outputTokens: estimateTokens(text) } : { inputTokens: 0, outputTokens: 0 }
      await settle(clientGone ? 'aborted' : 'error', partial).catch((e) => toApiError(e, 'chat.stream.refund'))
      await send('error', apiErr.toBody().error)
    } finally {
      c.request.signal?.removeEventListener('abort', onClientAbort)
      await writer.close().catch(() => {})
    }
  }
  c.ctx.waitUntil(pump())

  return new Response(readable, { status: 200, headers: sseHeaders() })
}
