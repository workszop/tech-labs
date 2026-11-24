import type { Capabilities } from '../../shared/api-types'
import type { Config } from './env'

/** Server-side hard limits. Client values are validated against these. */
export const LIMITS = {
  maxEmbeddingsBodyBytes: 512 * 1024,
  maxAgentBodyBytes: 256 * 1024,
  maxActivateBodyBytes: 4 * 1024,
  maxAdminBodyBytes: 32 * 1024,

  maxEmbeddingBatch: 64,
  maxEmbeddingInputTokens: 2000,

  /** Raw access-code input length before normalisation. */
  maxCodeInputChars: 64,

  /** Per-run limits of POST /api/agent, published in Capabilities.agent (the first three are overridable by vars). */
  agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 80_000, maxMessageChars: 1000 },
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
    agent: {
      ...LIMITS.agent,
      maxSteps: cfg.agentMaxSteps,
      maxToolCalls: cfg.agentMaxToolCalls,
      maxRunTokens: cfg.agentMaxRunTokens,
    },
  }
}
