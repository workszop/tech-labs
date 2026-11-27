/**
 * RAG Lab — API contract shared by the browser app (rag-lab/web) and the
 * Cloudflare Worker (rag-lab/worker). Keep this file dependency-free.
 *
 * Transport rules
 * - All bodies are JSON (UTF-8) unless noted. Streaming chat uses text/event-stream.
 * - Authenticated endpoints take `Authorization: Bearer <sessionToken>`.
 *   The session token is returned by POST /api/activate and is kept in browser
 *   memory only (never in URLs, localStorage or cookies).
 * - Every error response has the shape `ApiErrorBody` and a matching HTTP status.
 */

// ---------------------------------------------------------------- errors

export type ApiErrorCode =
  | 'invalid_request' // 400 malformed body / bad params
  | 'invalid_code' // 401 activation: unknown code
  | 'expired_code' // 403 activation or later: the code passed its expiry date
  | 'revoked_code' // 403 the administrator revoked / disabled the code
  | 'too_many_sessions' // 403 activation: code reached max concurrent sessions
  | 'unauthorized' // 401 missing / unknown bearer token
  | 'session_expired' // 401 session past expires_at or revoked
  | 'quota_exceeded' // 402 request or token budget of the code is spent
  | 'rate_limited' // 429 too many requests per minute (session) or activation attempts (IP)
  | 'payload_too_large' // 413 body / inputs / tokens above server limits
  | 'origin_not_allowed' // 403 CORS origin not in ALLOWED_ORIGINS
  | 'model_not_allowed' // 400 requested model not in allowlist (frontend never chooses upstream URLs)
  | 'upstream_unavailable' // 502 provider failed / network
  | 'upstream_timeout' // 504 provider took too long
  | 'upstream_bad_response' // 502 provider answered with something malformed
  | 'not_found' // 404
  | 'internal' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    /** Human readable, safe to show to the user. Never contains secrets or stack traces. */
    message: string
    /** Present for rate_limited. */
    retryAfterSeconds?: number
  }
}

// ---------------------------------------------------------------- session

export interface NumberRange {
  min: number
  max: number
  default: number
}

export interface Capabilities {
  /** 'mock' = deterministic offline dev provider (hash embeddings, extractive answers). */
  provider: 'openai-compatible' | 'mock'
  embeddingModel: string
  embeddingDimensions: number
  chatModel: string
  /** Max number of strings in one POST /api/embeddings call. */
  maxEmbeddingBatch: number
  /** Max estimated tokens for a single embedding input string. */
  maxEmbeddingInputTokens: number
  /** Max number of context chunks in one POST /api/chat. */
  maxContextChunks: number
  /** Max estimated input tokens (system + context + question) for chat. */
  maxChatInputTokens: number
  maxQuestionChars: number
  maxOutputTokens: NumberRange
  temperature: NumberRange
  streaming: boolean
}

export interface UsageInfo {
  requestsUsed: number
  requestLimit: number
  tokensUsed: number
  tokenLimit: number
  /** Server-side estimate in USD, from configured per-1M-token prices. */
  estimatedCostUsd: number
  /** ISO timestamp or null. */
  codeExpiresAt: string | null
}

export interface SessionInfo {
  /** Short, non-secret identifier for display (first 8 chars of session id). */
  sessionRef: string
  label: string | null
  /** ISO timestamp. */
  expiresAt: string
  capabilities: Capabilities
  usage: UsageInfo
}

/** POST /api/activate */
export interface ActivateRequest {
  code: string
}
export interface ActivateResponse {
  token: string
  session: SessionInfo
}

/** GET /api/session → SessionInfo */
/** POST /api/logout → 204 */
/** GET /api/usage → UsageInfo */

// ---------------------------------------------------------------- embeddings

/** POST /api/embeddings */
export interface EmbeddingsRequest {
  inputs: string[]
  /** Optional hint: language of the inputs ('pl' | 'en'). Only the offline mock model uses it. */
  lang?: 'pl' | 'en'
}
export interface EmbeddingsResponse {
  model: string
  dimensions: number
  /** One vector per input, same order. */
  embeddings: number[][]
  usage: { inputTokens: number }
  durationMs: number
  /** Usage after this request was accounted. */
  quota: UsageInfo
}

// ---------------------------------------------------------------- chat

export interface ContextChunk {
  /** Chunk id from the browser index, e.g. "proces-04#2". */
  chunkId: string
  documentTitle: string
  folder: string
  text: string
}

export type ChatMode = 'rag' | 'no-rag'

/** POST /api/chat */
/** Language of the documents, the prompt template and the answer. */
export type Lang = 'pl' | 'en'

export interface ChatRequest {
  /** Default 'en'. Selects the prompt template (see shared/prompt.ts). */
  lang?: Lang
  question: string
  /** Must be [] when mode === 'no-rag'. Order defines citation numbers [1], [2], ... */
  context: ContextChunk[]
  mode: ChatMode
  temperature?: number
  maxTokens?: number
  /** Default true. When true the response is text/event-stream (see ChatStreamEvent). */
  stream?: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** The exact request the Worker sent upstream (minus credentials). */
export interface PromptEcho {
  model: string
  temperature: number
  maxTokens: number
  messages: ChatMessage[]
}

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
}

/** Non-streaming JSON response. */
export interface ChatResponse {
  prompt: PromptEcho
  answer: string
  finishReason: string | null
  usage: ChatUsage
  durationMs: number
  quota: UsageInfo
}

/**
 * Streaming response: `text/event-stream`, each event is
 *   event: <type>\n data: <json>\n\n
 * Order: exactly one `prompt`, zero or more `delta`, then exactly one `done` or `error`.
 */
export type ChatStreamEvent =
  | { type: 'prompt'; data: PromptEcho }
  | { type: 'delta'; data: { text: string } }
  | {
      type: 'done'
      data: { finishReason: string | null; usage: ChatUsage; durationMs: number; quota: UsageInfo }
    }
  | { type: 'error'; data: ApiErrorBody['error'] }

// ---------------------------------------------------------------- admin

/**
 * Admin endpoints are authenticated separately from participants:
 *  - Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) when ACCESS_TEAM_DOMAIN + ACCESS_AUD are set, or
 *  - `Authorization: Bearer <ADMIN_TOKEN secret>`.
 * Participant session tokens and access codes are never accepted here.
 */
export type CodeStatus = 'active' | 'disabled' | 'revoked' | 'expired' | 'exhausted'

export interface AdminCreateCodesRequest {
  /** 1..200, default 1 */
  count?: number
  label?: string
  /** ISO timestamp */
  expiresAt?: string | null
  requestLimit?: number
  tokenLimit?: number
  maxSessions?: number
}

export interface AdminCodeRecord {
  id: string
  label: string | null
  status: CodeStatus
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  requestLimit: number
  tokenLimit: number
  maxSessions: number
  requestsUsed: number
  tokensUsed: number
  estimatedCostUsd: number
  activeSessions: number
  lastUsedAt: string | null
}

export interface AdminCreateCodesResponse {
  /** Plaintext codes are returned exactly once and never stored. */
  codes: (AdminCodeRecord & { code: string })[]
}

export interface AdminListCodesResponse {
  codes: AdminCodeRecord[]
  totals: { requests: number; tokens: number; estimatedCostUsd: number }
}

/** PATCH /api/admin/codes/:id */
export interface AdminUpdateCodeRequest {
  label?: string | null
  expiresAt?: string | null
  requestLimit?: number
  tokenLimit?: number
  maxSessions?: number
  status?: 'active' | 'disabled'
  /** Sets requests_used / tokens_used / estimated cost back to 0 (usage_events are kept). */
  resetUsage?: boolean
  /** Revokes every session of this code (participants must re-activate). */
  revokeSessions?: boolean
}

/** DELETE /api/admin/codes/:id → revokes the code and all its sessions → AdminCodeRecord */
