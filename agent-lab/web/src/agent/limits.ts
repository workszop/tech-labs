/**
 * Client-side limits of an agent run. The Worker enforces its own per-run
 * limits (steps, tool calls, tokens); these protect the browser from a slow or
 * misbehaving model and keep every request inside the Worker's request limits.
 */
import { estimateTokens, type AgentMessage } from '@shared/api-types'

/** One POST /api/agent call (one model turn). */
export const MODEL_CALL_TIMEOUT_MS = 60_000
/** One tool execution in the browser. */
export const TOOL_TIMEOUT_MS = 20_000
/** The whole run, without the time the user spends deciding on a confirmation. */
export const RUN_TIMEOUT_MS = 180_000
/** Used as the step guard until the first response reports the Worker's `limits.maxSteps`. */
export const DEFAULT_MAX_STEPS = 8
/** The third identical call (same tool and arguments) in one run ends the run. */
export const MAX_IDENTICAL_CALLS = 3

/** Worker limit for the content of one tool message (`LIMITS.agentRequest.maxToolContentChars`). */
export const MAX_TOOL_CONTENT_CHARS = 16_000

/**
 * Budget for the model history of earlier runs in the same conversation. The
 * Worker allows 60 messages and about 24 000 estimated input tokens per request,
 * including the system prompt, the tool definitions and the messages of the run
 * in progress (up to 8 steps with up to 5 tool results each), so earlier runs get
 * a fixed share of it.
 */
export const HISTORY_MAX_MESSAGES = 24
export const HISTORY_MAX_TOKENS = 8_000

/** Number of finished runs kept in IndexedDB. */
export const MAX_STORED_RUNS = 20

/** Same estimate as the Worker uses for the request size check. */
export function estimateMessagesTokens(messages: AgentMessage[]): number {
  return estimateTokens(JSON.stringify(messages))
}

/**
 * Keeps the newest complete exchanges (a user message and every assistant and
 * tool message up to the next user message) that fit the budget. An assistant
 * message with tool calls is therefore never separated from its tool results.
 */
export function boundHistory(
  history: AgentMessage[],
  budget: { maxMessages: number; maxTokens: number } = { maxMessages: HISTORY_MAX_MESSAGES, maxTokens: HISTORY_MAX_TOKENS },
): AgentMessage[] {
  const exchanges: AgentMessage[][] = []
  for (const m of history) {
    if (m.role === 'user' || exchanges.length === 0) exchanges.push([])
    exchanges[exchanges.length - 1]!.push(m)
  }
  // An exchange that does not start with a user message cannot be sent (the Worker requires a user message first).
  while (exchanges.length && exchanges[0]![0]!.role !== 'user') exchanges.shift()
  const kept: AgentMessage[][] = []
  let messages = 0
  let tokens = 0
  for (let i = exchanges.length - 1; i >= 0; i--) {
    const ex = exchanges[i]!
    const exTokens = estimateMessagesTokens(ex)
    if (messages + ex.length > budget.maxMessages || tokens + exTokens > budget.maxTokens) break
    kept.unshift(ex)
    messages += ex.length
    tokens += exTokens
  }
  return kept.flat()
}

function shortenStrings(v: unknown, max: number): unknown {
  if (typeof v === 'string') return v.length > max ? `${v.slice(0, max)}…` : v
  if (Array.isArray(v)) return v.map((x) => shortenStrings(x, max))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shortenStrings(x, max)]))
  return v
}

/**
 * Makes a tool message fit the Worker's limit and stay valid JSON:
 * 1. long string values are cut to 2000 characters (marked with "…"); if the
 *    result is an array (knowledge hits, best first), items are then dropped from
 *    the end, keeping at least one, so the best hits stay complete;
 * 2. if that is still too long, step 1 is repeated with 1000, 500 and 200 characters;
 * 3. as a last resort the text becomes `{ "truncated": true, "preview": "<start of the result>" }`.
 */
export function fitToolContent(content: string, max = MAX_TOOL_CONTENT_CHARS): string {
  if (content.length <= max) return content
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    value = undefined
  }
  if (value !== undefined) {
    for (const limit of [2000, 1000, 500, 200]) {
      let v = shortenStrings(value, limit)
      let text = JSON.stringify(v)
      while (Array.isArray(v) && v.length > 1 && text.length > max) {
        v = v.slice(0, -1)
        text = JSON.stringify(v)
      }
      if (text.length <= max) return text
    }
  }
  let preview = content.slice(0, Math.floor(max / 2))
  let text = JSON.stringify({ truncated: true, preview })
  while (text.length > max) {
    preview = preview.slice(0, Math.floor(preview.length / 2))
    text = JSON.stringify({ truncated: true, preview })
  }
  return text
}
