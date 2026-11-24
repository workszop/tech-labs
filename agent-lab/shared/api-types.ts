/**
 * Service Agent Lab - API contract shared by the browser app (agent-lab/web) and
 * the Cloudflare Worker (agent-lab/worker). It depends only on the other files
 * in agent-lab/shared.
 *
 * Transport rules
 * - All bodies are JSON (UTF-8).
 * - Authenticated endpoints take `Authorization: Bearer <sessionToken>`.
 *   The session token is returned by POST /api/activate and is kept in browser
 *   memory only (never in URLs, localStorage or cookies).
 * - Every error response has the shape `ApiErrorBody` and a matching HTTP status.
 */
import type { SystemId, ToolName } from './tools'

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
  | 'run_limit_exceeded' // 409 the agent run already used its steps or token budget
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

export interface Capabilities {
  /** 'mock' = deterministic offline dev provider (hash embeddings, rule-based agent). */
  provider: 'openai-compatible' | 'mock'
  embeddingModel: string
  embeddingDimensions: number
  chatModel: string
  /** Max number of strings in one POST /api/embeddings call. */
  maxEmbeddingBatch: number
  /** Max estimated tokens for a single embedding input string. */
  maxEmbeddingInputTokens: number
  /** Per-run limits of POST /api/agent. */
  agent: {
    maxSteps: number
    maxToolCalls: number
    maxParallelToolCalls: number
    maxRunTokens: number
    maxMessageChars: number
  }
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

// ---------------------------------------------------------------- language and helpers

/** Language of the UI, the company texts, the knowledge base and the agent's system prompt. */
export type Lang = 'pl' | 'en'

export function isLang(v: unknown): v is Lang {
  return v === 'pl' || v === 'en'
}

/** Rough token estimate (about 4 characters per token) used for budgeting only. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** A plain chat message as sent upstream by the providers. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
}

// ---------------------------------------------------------------- agent

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type AgentMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  /** content = JSON text of the tool result. */
  | { role: 'tool'; toolCallId: string; name: string; content: string }

/** POST /api/agent: one model turn of a run. */
export interface AgentRequest {
  /** uuid, new for every customer message. */
  runId: string
  lang: Lang
  customer: { id: string; name: string }
  enabledTools: ToolName[]
  /** Whole conversation so far, no system message. */
  messages: AgentMessage[]
}

export type RejectReason = 'unknown_tool' | 'tool_disabled' | 'invalid_arguments' | 'too_many_calls'

export interface ValidatedToolCall extends ToolCall {
  name: ToolName
  system: SystemId
  readOnly: boolean
  requiresConfirmation: boolean
}

export interface RejectedToolCall {
  id: string
  name: string
  rawArguments: string
  reason: RejectReason
  message: string
}

export interface AgentLimits {
  maxSteps: number
  maxToolCalls: number
  maxRunTokens: number
  stepsUsed: number
  toolCallsUsed: number
  runTokens: number
}

export interface AgentResponse {
  runId: string
  /** 1-based model turn within the run. */
  step: number
  model: string
  kind: 'tool_calls' | 'final'
  /** Append verbatim to the transcript. */
  assistantMessage: Extract<AgentMessage, { role: 'assistant' }>
  /** Execute these. */
  toolCalls: ValidatedToolCall[]
  /** Answer each with an error tool message, do not execute. */
  rejected: RejectedToolCall[]
  /** True when the Worker removed the tools because a run limit was reached. */
  forcedFinal: boolean
  finishReason: string | null
  usage: ChatUsage
  durationMs: number
  quota: UsageInfo
  limits: AgentLimits
}

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
