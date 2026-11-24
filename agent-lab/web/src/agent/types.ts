/**
 * Types of the agent run: the trace events the whole UI renders, the engine's
 * dependencies, the persisted run record and the chat items.
 */
import type { AgentMessage, AgentRequest, AgentResponse, ChatUsage, Lang, ValidatedToolCall } from '@shared/api-types'
import type { SystemId, ToolName } from '@shared/tools'
import type { ToolContext, ToolResult, executeTool } from '@/sim/tools'

/**
 * What happened in a run, emitted by the engine at the moment it happens.
 *
 * Order within a run:
 * - `run_started`
 * - per model turn: `model_started`, then `model_finished`
 * - after a `tool_calls` turn, in this order:
 *   1. `tool_started` for every call that does not need a confirmation, in the
 *      model's order: rejected calls (`system: null` when the name is not a
 *      known tool), repeated identical calls and the read-only calls;
 *   2. `tool_finished` for the rejected and repeated calls (error results, never
 *      executed), then for the read-only calls as each completes (they run in
 *      parallel, so the order of their `tool_finished` events may differ);
 *   3. one at a time, for each call that needs a confirmation: `tool_started`,
 *      `confirmation_requested`, `confirmation_resolved`, `tool_finished`
 *      (`rejected_by_user` when not approved; the tool did not run). For an
 *      approved call `durationMs` covers the execution only, not the decision.
 * - `run_finished` (always last; once per run).
 *
 * `seq` increases over the whole run. Calls that never ran (rejected, repeated,
 * rejected by the user, not run) have `durationMs: 0`. Engine-made closures use
 * two codes that are not tool failures:
 * - `not_executed`: the call certainly did not run (cancel before or at the
 *   decision, valid calls on a forced-final turn); no `confirmation_resolved`
 *   is emitted for a cancelled confirmation;
 * - `result_unknown`: the call was started and may have run, but its result was
 *   not recorded (cancel or run timeout during read-only calls; on restore after
 *   a reload: a read-only call or an approved call without a result).
 * Restore closures (`sim/runs.ts`) are appended when the run is loaded and are
 * dated at the last recorded event of the run.
 *
 * `run_finished.detail` is a `RunEndReason` code (absent when `answered`).
 */
export type TraceEvent =
  | { type: 'run_started'; runId: string; at: number; customerId: string; message: string; enabledTools: ToolName[] }
  | { type: 'model_started'; step: number; at: number }
  | {
      type: 'model_finished'
      step: number
      at: number
      durationMs: number
      kind: 'tool_calls' | 'final'
      text: string
      usage: ChatUsage
      forcedFinal: boolean
    }
  | {
      type: 'tool_started'
      step: number
      callId: string
      seq: number
      name: string
      system: SystemId | null
      readOnly: boolean
      args: Record<string, unknown>
      at: number
    }
  | { type: 'confirmation_requested'; callId: string; at: number }
  | { type: 'confirmation_resolved'; callId: string; approved: boolean; at: number }
  | { type: 'tool_finished'; callId: string; at: number; durationMs: number; result: ToolResult }
  | { type: 'run_finished'; at: number; outcome: RunOutcome; detail?: string; answer: string }

export type RunOutcome = 'answered' | 'cancelled' | 'limit' | 'error'

/**
 * Why a run ended without (or with a limited) answer. Worker error codes
 * (`ApiErrorCode`, `network`) are passed through as they are for `error`.
 */
export type RunEndReason =
  | 'cancelled' // the user cancelled
  | 'reload' // the page was reloaded while the run was in progress
  | 'max_steps' // client-side step guard
  | 'run_timeout' // the whole run took longer than RUN_TIMEOUT_MS
  | 'model_timeout' // one model call took longer than MODEL_CALL_TIMEOUT_MS
  | 'tool_loop' // the model asked for the same call a third time
  | 'forced_final' // the Worker removed the tools because a run limit was reached
  | 'run_limit_exceeded' // Worker 409
  | 'quota_exceeded' // Worker 402
  | 'empty_answer' // the model finished without any text
  | (string & {})

export interface RunInput {
  runId: string
  lang: Lang
  customer: { id: string; name: string }
  enabledTools: ToolName[]
  /** Model transcript of earlier runs of the conversation (bounded by the caller). */
  history: AgentMessage[]
  message: string
}

export interface RunResult {
  /** `history` + this run's messages; every tool call is answered, so it can be sent again. */
  transcript: AgentMessage[]
  outcome: RunOutcome
  /** The model's final text; empty when the run ended without one. */
  answer: string
  reason?: RunEndReason
  /** Human readable message for the notice (Worker or client error text). */
  detail?: string
}

export interface EngineDeps {
  agentStep: (req: AgentRequest, signal: AbortSignal) => Promise<AgentResponse>
  executeTool: typeof executeTool
  toolContext: ToolContext
  /** Resolves when the user decides. */
  confirm: (call: ValidatedToolCall, signal: AbortSignal) => Promise<boolean>
  emit: (e: TraceEvent) => void
  now: () => number
}

/** A run as kept in the store and in IndexedDB (last 20). */
export interface RunRecord {
  id: string
  scenarioId: string | null
  customerId: string
  message: string
  enabledTools: ToolName[]
  startedAt: number
  events: TraceEvent[]
  /** Absent while the run is in progress. */
  outcome?: RunOutcome
  answer?: string
  model: string
  lang: Lang
  /** Id of the run whose question this run repeats ("Repeat this question"); absent in older records. */
  repeatOf?: string
}

/** Localized notice texts: `shell.runNotices[key]`. */
export type RunNoticeKey =
  | 'cancelled'
  | 'reload'
  | 'max_steps'
  | 'run_timeout'
  | 'model_timeout'
  | 'tool_loop'
  | 'forced_final'
  | 'run_limit_exceeded'
  | 'quota_exceeded'
  | 'error'

export const NOTICE_KEYS: readonly RunNoticeKey[] = [
  'cancelled', 'reload', 'max_steps', 'run_timeout', 'model_timeout', 'tool_loop', 'forced_final', 'run_limit_exceeded', 'quota_exceeded', 'error',
]

export function noticeKeyFor(reason: RunEndReason | undefined, outcome: RunOutcome): RunNoticeKey {
  if (reason && (NOTICE_KEYS as readonly string[]).includes(reason)) return reason as RunNoticeKey
  return outcome === 'cancelled' ? 'cancelled' : 'error'
}

/**
 * One item of the customer chat. Sources of an agent reply are derived by the UI
 * from the run's events (`runs[].events`), not stored here.
 */
export type ChatItem =
  | { kind: 'customer'; id: string; runId: string; text: string; at: number }
  | { kind: 'agent'; id: string; runId: string; text: string; at: number }
  | {
      kind: 'confirmation'
      id: string
      runId: string
      callId: string
      call: ValidatedToolCall
      /** `cancelled`: the run was cancelled or the page reloaded before a decision. */
      state: 'pending' | 'approved' | 'rejected' | 'cancelled'
      at: number
    }
  | { kind: 'notice'; id: string; runId: string; outcome: Exclude<RunOutcome, 'answered'>; messageKey: RunNoticeKey; detail?: string; at: number }
