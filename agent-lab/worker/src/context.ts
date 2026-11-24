import type { Config, Env } from './env'
import type { FetchLike } from './providers/openai-compatible'

export interface RequestContext {
  request: Request
  env: Env
  cfg: Config
  ctx: ExecutionContext
  url: URL
  params: Record<string, string>
  /** Start of request handling (ms since epoch). */
  now: number
  /** Overridable for tests; defaults to global fetch. */
  fetch?: FetchLike
}

export function cost(cfg: Config, op: 'embeddings' | 'chat', inputTokens: number, outputTokens: number): number {
  if (op === 'embeddings') return (inputTokens * cfg.embeddingPricePerMTok) / 1e6
  return (inputTokens * cfg.chatInputPricePerMTok + outputTokens * cfg.chatOutputPricePerMTok) / 1e6
}
