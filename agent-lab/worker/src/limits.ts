import type { Capabilities, NumberRange } from '../../shared/api-types'
import type { Config } from './env'

/** Server-side hard limits. Client values are validated / clamped against these. */
export const LIMITS = {
  maxEmbeddingsBodyBytes: 512 * 1024,
  maxAgentBodyBytes: 256 * 1024,
  maxActivateBodyBytes: 4 * 1024,
  maxAdminBodyBytes: 32 * 1024,

  maxEmbeddingBatch: 64,
  maxEmbeddingInputTokens: 2000,
  maxContextChunks: 10,
  maxQuestionChars: 1000,
  maxChatInputTokens: 12_000,

  maxOutputTokens: { min: 64, max: 1024, default: 500 } satisfies NumberRange,
  temperature: { min: 0, max: 1, default: 0.2 } satisfies NumberRange,

  /** Raw access-code input length before normalisation. */
  maxCodeInputChars: 64,

  /** Per-run limits of POST /api/agent, published in Capabilities.agent (the first three are overridable by vars). */
  agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 40_000, maxMessageChars: 1000 },
  /** POST /api/agent request shape and model call. */
  agentRequest: {
    maxMessages: 60,
    maxToolContentChars: 16_000,
    maxCustomerNameChars: 80,
    maxInputTokens: 24_000,
    maxOutputTokens: 700,
    temperature: 0.2,
  },
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
    streaming: false,
    agent: {
      ...LIMITS.agent,
      maxSteps: cfg.agentMaxSteps,
      maxToolCalls: cfg.agentMaxToolCalls,
      maxRunTokens: cfg.agentMaxRunTokens,
    },
  }
}

export function clamp(n: number, range: NumberRange): number {
  return Math.min(range.max, Math.max(range.min, n))
}
