import { type EmbeddingsResponse, estimateTokens, isLang } from '../../../shared/api-types'
import { requireSession } from '../auth/session'
import { cost, type RequestContext } from '../context'
import { reserveQuota, settleUsage, usageInfo } from '../db'
import { ApiError, isObject, json, readJson, toApiError } from '../http'
import { LIMITS } from '../limits'
import { createProvider } from '../providers'
import { enforceSessionRateLimit } from '../ratelimit'

/** Rejects attempts to pick a model from the client (the server decides). */
export function assertNoClientModel(body: Record<string, unknown>, serverModel: string): void {
  if ('model' in body && body.model !== undefined && body.model !== serverModel) {
    throw new ApiError('model_not_allowed', 'The model is chosen by the server and cannot be changed by the client.')
  }
}

export function validateEmbeddingInputs(body: unknown): string[] {
  if (!isObject(body) || !Array.isArray(body.inputs)) {
    throw new ApiError('invalid_request', 'Body must be {"inputs": string[]}.')
  }
  const inputs = body.inputs as unknown[]
  if (inputs.length === 0) throw new ApiError('invalid_request', '`inputs` must contain at least one string.')
  if (inputs.length > LIMITS.maxEmbeddingBatch) {
    throw new ApiError('payload_too_large', `At most ${LIMITS.maxEmbeddingBatch} inputs per request.`)
  }
  inputs.forEach((s, i) => {
    if (typeof s !== 'string') throw new ApiError('invalid_request', `inputs[${i}] must be a string.`)
    if (s.trim() === '') throw new ApiError('invalid_request', `inputs[${i}] must not be empty.`)
    if (estimateTokens(s) > LIMITS.maxEmbeddingInputTokens) {
      throw new ApiError('payload_too_large', `inputs[${i}] is longer than ${LIMITS.maxEmbeddingInputTokens} estimated tokens.`)
    }
  })
  return inputs as string[]
}

/** POST /api/embeddings */
export async function handleEmbeddings(c: RequestContext): Promise<Response> {
  const { session, code } = await requireSession(c.request, c.env.DB, c.cfg, c.now)
  await enforceSessionRateLimit(c, session.id)
  const body = await readJson(c.request, LIMITS.maxEmbeddingsBodyBytes)
  const inputs = validateEmbeddingInputs(body)
  const rawLang = (body as Record<string, unknown>).lang
  if (rawLang !== undefined && rawLang !== null && !isLang(rawLang)) throw new ApiError('invalid_request', '`lang` must be "pl" or "en".')
  const lang = isLang(rawLang) ? rawLang : undefined
  const provider = createProvider(c.cfg, c.fetch)
  assertNoClientModel(body as Record<string, unknown>, provider.embeddingModel)

  const est = inputs.reduce((n, s) => n + estimateTokens(s), 0)
  await reserveQuota(c.env.DB, code.id, est, c.now)

  const t0 = Date.now()
  try {
    const result = await provider.embed(inputs, c.request.signal, lang)
    const inputTokens = result.inputTokens ?? est
    const settled = await settleUsage(
      c.env.DB,
      {
        accessCodeId: code.id,
        sessionId: session.id,
        model: result.model,
        operation: 'embeddings',
        inputTokens,
        outputTokens: 0,
        cost: cost(c.cfg, 'embeddings', inputTokens, 0),
        status: 'ok',
      },
      est,
      Date.now(),
    )
    const res: EmbeddingsResponse = {
      model: result.model,
      dimensions: provider.embeddingDimensions,
      embeddings: result.embeddings,
      usage: { inputTokens },
      durationMs: Date.now() - t0,
      quota: usageInfo(settled ?? code),
    }
    return json(res)
  } catch (err) {
    const apiErr = toApiError(err, 'embeddings')
    await settleUsage(
      c.env.DB,
      {
        accessCodeId: code.id,
        sessionId: session.id,
        model: provider.embeddingModel,
        operation: 'embeddings',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        status: 'error',
      },
      est,
      Date.now(),
    ).catch((e) => toApiError(e, 'embeddings.refund'))
    throw apiErr
  }
}
