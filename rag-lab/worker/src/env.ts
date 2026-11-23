/**
 * Environment bindings and parsed configuration.
 *
 * Everything the frontend could abuse (provider URL, models, limits, prices)
 * comes from here — never from the request.
 */

export interface Env {
  DB: D1Database
  /** Optional Workers Rate Limiting binding (extra per-session limiter). D1 works alone. */
  RATE_LIMITER?: RateLimit

  // --- provider
  PROVIDER?: string
  PROVIDER_BASE_URL?: string
  PROVIDER_API_KEY?: string // secret
  EMBEDDING_MODEL?: string
  CHAT_MODEL?: string
  ALLOWED_MODELS?: string
  EMBEDDING_DIMENSIONS?: string
  EMBED_TIMEOUT_MS?: string
  CHAT_TIMEOUT_MS?: string
  MOCK_STREAM_DELAY_MS?: string

  // --- prices (USD per 1M tokens)
  EMBEDDING_PRICE_PER_MTOK?: string
  CHAT_INPUT_PRICE_PER_MTOK?: string
  CHAT_OUTPUT_PRICE_PER_MTOK?: string

  // --- security
  ALLOWED_ORIGINS?: string
  CODE_PEPPER?: string // secret
  ADMIN_TOKEN?: string // secret
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string

  // --- sessions / throttling
  SESSION_TTL_MINUTES?: string
  SESSION_IDLE_TIMEOUT_MINUTES?: string
  RATE_LIMIT_PER_MINUTE?: string
  ACTIVATION_MAX_ATTEMPTS?: string
  ACTIVATION_WINDOW_SECONDS?: string
  ACTIVATION_GLOBAL_FAILURES_PER_MINUTE?: string
  ACTIVATION_MIN_RESPONSE_MS?: string

  // --- defaults for new codes
  DEFAULT_REQUEST_LIMIT?: string
  DEFAULT_TOKEN_LIMIT?: string
  DEFAULT_MAX_SESSIONS?: string

  // --- maintenance
  CLEANUP_RETENTION_DAYS?: string
}

export type ProviderName = 'openai-compatible' | 'mock'

export const MOCK_EMBEDDING_MODEL = 'mock-hash-embedding-256'
export const MOCK_CHAT_MODEL = 'mock-extractive-chat'
export const MOCK_EMBEDDING_DIMENSIONS = 256

export interface Config {
  provider: ProviderName
  providerBaseUrl: string
  providerApiKey: string
  embeddingModel: string
  chatModel: string
  embeddingDimensions: number
  allowedModels: Set<string>
  embedTimeoutMs: number
  chatTimeoutMs: number
  mockStreamDelayMs: number

  embeddingPricePerMTok: number
  chatInputPricePerMTok: number
  chatOutputPricePerMTok: number

  allowedOrigins: Set<string>
  codePepper: string
  adminToken: string
  accessTeamDomain: string
  accessAud: string

  sessionTtlMinutes: number
  sessionIdleTimeoutMinutes: number
  rateLimitPerMinute: number
  activationMaxAttempts: number
  activationWindowSeconds: number
  activationGlobalFailuresPerMinute: number
  activationMinResponseMs: number

  defaultRequestLimit: number
  defaultTokenLimit: number
  defaultMaxSessions: number

  cleanupRetentionDays: number
}

function num(v: string | undefined, def: number, min: number, max: number): number {
  if (v === undefined || v.trim() === '') return def
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function loadConfig(env: Env): Config {
  const provider: ProviderName = (env.PROVIDER ?? '').trim() === 'mock' ? 'mock' : 'openai-compatible'
  const isMock = provider === 'mock'
  const embeddingModel = isMock ? MOCK_EMBEDDING_MODEL : (env.EMBEDDING_MODEL?.trim() || 'text-embedding-3-small')
  const chatModel = isMock ? MOCK_CHAT_MODEL : (env.CHAT_MODEL?.trim() || 'gpt-4o-mini')
  const allowed = new Set(list(env.ALLOWED_MODELS))
  if (isMock) {
    allowed.add(MOCK_EMBEDDING_MODEL)
    allowed.add(MOCK_CHAT_MODEL)
  }
  return {
    provider,
    providerBaseUrl: (env.PROVIDER_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    providerApiKey: env.PROVIDER_API_KEY ?? '',
    embeddingModel,
    chatModel,
    embeddingDimensions: isMock ? MOCK_EMBEDDING_DIMENSIONS : Math.round(num(env.EMBEDDING_DIMENSIONS, 1536, 1, 16384)),
    allowedModels: allowed,
    embedTimeoutMs: num(env.EMBED_TIMEOUT_MS, 20_000, 100, 300_000),
    chatTimeoutMs: num(env.CHAT_TIMEOUT_MS, 60_000, 100, 300_000),
    mockStreamDelayMs: num(env.MOCK_STREAM_DELAY_MS, 25, 0, 2000),

    embeddingPricePerMTok: num(env.EMBEDDING_PRICE_PER_MTOK, 0.02, 0, 1000),
    chatInputPricePerMTok: num(env.CHAT_INPUT_PRICE_PER_MTOK, 0.15, 0, 1000),
    chatOutputPricePerMTok: num(env.CHAT_OUTPUT_PRICE_PER_MTOK, 0.6, 0, 1000),

    allowedOrigins: new Set(list(env.ALLOWED_ORIGINS)),
    codePepper: env.CODE_PEPPER ?? '',
    adminToken: env.ADMIN_TOKEN ?? '',
    accessTeamDomain: (env.ACCESS_TEAM_DOMAIN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    accessAud: (env.ACCESS_AUD ?? '').trim(),

    sessionTtlMinutes: num(env.SESSION_TTL_MINUTES, 240, 1, 60 * 24 * 30),
    sessionIdleTimeoutMinutes: num(env.SESSION_IDLE_TIMEOUT_MINUTES, 0, 0, 60 * 24 * 30),
    rateLimitPerMinute: Math.round(num(env.RATE_LIMIT_PER_MINUTE, 30, 1, 100_000)),
    activationMaxAttempts: Math.round(num(env.ACTIVATION_MAX_ATTEMPTS, 10, 1, 100_000)),
    activationWindowSeconds: Math.round(num(env.ACTIVATION_WINDOW_SECONDS, 900, 10, 86_400)),
    activationGlobalFailuresPerMinute: Math.round(num(env.ACTIVATION_GLOBAL_FAILURES_PER_MINUTE, 60, 1, 1_000_000)),
    activationMinResponseMs: num(env.ACTIVATION_MIN_RESPONSE_MS, 250, 0, 5000),

    defaultRequestLimit: Math.round(num(env.DEFAULT_REQUEST_LIMIT, 300, 0, 10_000_000)),
    defaultTokenLimit: Math.round(num(env.DEFAULT_TOKEN_LIMIT, 300_000, 0, 10_000_000_000)),
    defaultMaxSessions: Math.round(num(env.DEFAULT_MAX_SESSIONS, 3, 1, 10_000)),

    cleanupRetentionDays: num(env.CLEANUP_RETENTION_DAYS, 7, 0, 3650),
  }
}

/** Minimum secret lengths; shorter values are treated as "not configured". */
export const MIN_PEPPER_LENGTH = 16
export const MIN_ADMIN_TOKEN_LENGTH = 24
