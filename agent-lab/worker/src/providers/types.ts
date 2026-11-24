import type { Lang } from '../../../shared/api-types'

export interface EmbedResult {
  model: string
  /** One vector per input, in input order. */
  embeddings: number[][]
  /** Provider-reported input tokens, or null if the provider did not report usage. */
  inputTokens: number | null
}

export interface ChatOptions {
  model: string
  temperature: number
  maxTokens: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** Result of OpenAICompatibleProvider.chat. No route calls chat since /api/chat was removed. */
export interface ChatResult {
  text: string
  finishReason: string | null
  /** null when the provider did not report usage. */
  usage: TokenUsage | null
}

export type ChatStreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'finish'; finishReason: string | null; usage: TokenUsage | null }

/**
 * Upstream LLM provider. Implementations throw `ApiError` with
 * upstream_unavailable / upstream_timeout / upstream_bad_response.
 */
export interface Provider {
  readonly name: 'openai-compatible' | 'mock'
  readonly embeddingModel: string
  readonly chatModel: string
  readonly embeddingDimensions: number
  /** `lang` is a hint about the inputs' language; real providers ignore it. */
  embed(inputs: string[], signal?: AbortSignal, lang?: Lang): Promise<EmbedResult>
}
