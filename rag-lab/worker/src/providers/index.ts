import type { Config } from '../env'
import { ApiError } from '../http'
import { MockProvider } from './mock'
import { type FetchLike, OpenAICompatibleProvider } from './openai-compatible'
import type { Provider } from './types'

export type { Provider } from './types'

/**
 * Builds the configured provider. Models come only from server config and must
 * be on the ALLOWED_MODELS allowlist (a misconfiguration fails closed).
 */
export function createProvider(cfg: Config, fetchImpl?: FetchLike): Provider {
  for (const m of [cfg.embeddingModel, cfg.chatModel]) {
    if (!cfg.allowedModels.has(m)) {
      console.error(JSON.stringify({ level: 'error', component: 'config', error: 'model_not_in_allowlist', model: m }))
      throw new ApiError('model_not_allowed', 'The server is configured with a model that is not on the allowlist.')
    }
  }
  if (cfg.provider === 'mock') return new MockProvider(cfg.mockStreamDelayMs)
  return new OpenAICompatibleProvider({
    baseUrl: cfg.providerBaseUrl,
    apiKey: cfg.providerApiKey,
    embeddingModel: cfg.embeddingModel,
    chatModel: cfg.chatModel,
    embeddingDimensions: cfg.embeddingDimensions,
    embedTimeoutMs: cfg.embedTimeoutMs,
    chatTimeoutMs: cfg.chatTimeoutMs,
    reasoningEffort: cfg.chatReasoningEffort,
    fetch: fetchImpl,
  })
}
