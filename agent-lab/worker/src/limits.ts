import type { Capabilities, NumberRange } from '../../shared/api-types'
import type { Config } from './env'

/** Server-side hard limits. Client values are validated / clamped against these. */
export const LIMITS = {
  maxEmbeddingsBodyBytes: 512 * 1024,
  maxChatBodyBytes: 128 * 1024,
  maxActivateBodyBytes: 4 * 1024,
  maxAdminBodyBytes: 32 * 1024,

  maxEmbeddingBatch: 64,
  maxEmbeddingInputTokens: 2000,
  maxContextChunks: 10,
  maxQuestionChars: 1000,
  maxChatInputTokens: 12_000,
  /** Metadata fields of a context chunk (chunkId, documentTitle, folder). */
  maxChunkMetaChars: 300,

  maxOutputTokens: { min: 64, max: 1024, default: 500 } satisfies NumberRange,
  temperature: { min: 0, max: 1, default: 0.2 } satisfies NumberRange,

  /** Raw access-code input length before normalisation. */
  maxCodeInputChars: 64,

  /** Per-run limits of POST /api/agent, published in Capabilities.agent. */
  agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 40_000, maxMessageChars: 1000 },
} as const

export function capabilities(cfg: Config): Capabilities {
  return {
    provider: cfg.provider,
    embeddingModel: cfg.embeddingModel,
    embeddingDimensions: cfg.embeddingDimensions,
    chatModel: cfg.chatModel,
    maxEmbeddingBatch: LIMITS.maxEmbeddingBatch,
    maxEmbeddingInputTokens: LIMITS.maxEmbeddingInputTokens,
    maxContextChunks: LIMITS.maxContextChunks,
    maxChatInputTokens: LIMITS.maxChatInputTokens,
    maxQuestionChars: LIMITS.maxQuestionChars,
    maxOutputTokens: { ...LIMITS.maxOutputTokens },
    temperature: { ...LIMITS.temperature },
    streaming: true,
    agent: { ...LIMITS.agent },
  }
}

export function clamp(n: number, range: NumberRange): number {
  return Math.min(range.max, Math.max(range.min, n))
}
