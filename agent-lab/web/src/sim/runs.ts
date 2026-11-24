/**
 * Persistence of the app state in the simulation database (`agent-lab-sim`):
 * the last runs with their trace events, the current conversation and the
 * preferences. A run that was still in progress (or waiting for a confirmation)
 * when the page was closed is restored as `cancelled`: nothing it was about to
 * do is done, and its open steps are closed in the trace.
 */
import type { AgentMessage, Lang } from '@shared/api-types'
import type { ToolName } from '@shared/tools'
import { MAX_STORED_RUNS } from '@/agent/limits'
import type { ChatItem, RunRecord, TraceEvent } from '@/agent/types'
import { simDb } from './db'
import { errorSummary } from './summaries'
import type { ToolResult } from './tools'

export interface StoredConversation {
  id: 'current'
  conversationId: string
  customerId: string
  lang: Lang
  items: ChatItem[]
  /** Model transcript of the conversation (user, assistant and tool messages). */
  history: AgentMessage[]
}

export interface StoredPrefs {
  id: 'prefs'
  lang: Lang
  activeCustomerId: string
  enabledTools: ToolName[]
}

/**
 * `tool_finished` events that close every started call without a result, for a
 * run that stopped without the engine closing it (page reload, or an engine bug).
 * What is known is said, nothing more:
 * - a call that was approved, or a read-only call, may have run: `result_unknown`;
 * - a call that waited for a decision never ran: `not_executed`.
 * They are dated `at` (the last recorded moment of the run) with `durationMs: 0`.
 */
export function closingEvents(events: TraceEvent[], at: number, lang: Lang): TraceEvent[] {
  const done = new Set(events.flatMap((e) => (e.type === 'tool_finished' ? [e.callId] : [])))
  const approved = new Set(events.flatMap((e) => (e.type === 'confirmation_resolved' && e.approved ? [e.callId] : [])))
  const out: TraceEvent[] = []
  for (const e of events) {
    if (e.type !== 'tool_started' || done.has(e.callId)) continue
    const unknown = approved.has(e.callId) || e.readOnly
    const result: ToolResult = unknown
      ? {
          ok: false,
          error: { code: 'result_unknown', message: 'The run stopped while this call was running. Whether it completed is not known; its result was not recorded.' },
          summary: errorSummary(lang, 'result_unknown'),
        }
      : {
          ok: false,
          error: { code: 'not_executed', message: 'The run stopped before a decision was made on this call. Nothing was executed.' },
          summary: errorSummary(lang, 'not_executed'),
        }
    out.push({ type: 'tool_finished', callId: e.callId, at, durationMs: 0, result })
  }
  return out
}

/**
 * Closes a run that has no outcome (`closingEvents`), then ends it as `cancelled`
 * with reason `reload`, dated at its last recorded event (the reload time is not
 * part of the run). Finished runs are returned unchanged.
 */
export function restoreInterruptedRun(run: RunRecord): RunRecord {
  if (run.outcome) return run
  const last = run.events.at(-1)?.at ?? run.startedAt
  const events: TraceEvent[] = [...run.events, ...closingEvents(run.events, last, run.lang)]
  if (events.at(-1)?.type !== 'run_finished') events.push({ type: 'run_finished', at: last, outcome: 'cancelled', detail: 'reload', answer: '' })
  return { ...run, events, outcome: 'cancelled', answer: '' }
}

/**
 * Chat items after a reload: a confirmation that was still pending becomes
 * `cancelled`, and each interrupted run gets a notice.
 */
export function restoreConversationItems(items: ChatItem[], interruptedRunIds: Set<string>, now: number): ChatItem[] {
  const out: ChatItem[] = items.map((i) => (i.kind === 'confirmation' && i.state === 'pending' ? { ...i, state: 'cancelled' } : i))
  for (const runId of interruptedRunIds) {
    if (!out.some((i) => i.runId === runId) || out.some((i) => i.kind === 'notice' && i.runId === runId)) continue
    out.push({ kind: 'notice', id: `notice-${runId}`, runId, outcome: 'cancelled', messageKey: 'reload', at: now })
  }
  return out
}

// ---------------------------------------------------------------- runs

export async function saveRun(run: RunRecord): Promise<void> {
  await simDb.runs.put(run)
}

/** Keeps the newest `MAX_STORED_RUNS` runs. */
export async function pruneRuns(keep = MAX_STORED_RUNS): Promise<void> {
  const ids = await simDb.runs.orderBy('startedAt').primaryKeys()
  if (ids.length > keep) await simDb.runs.bulkDelete(ids.slice(0, ids.length - keep))
}

/**
 * The stored runs, oldest first. Runs without an outcome are restored as
 * cancelled (and saved that way); `interrupted` lists their ids.
 */
export async function loadRuns(): Promise<{ runs: RunRecord[]; interrupted: Set<string> }> {
  await pruneRuns()
  const stored = await simDb.runs.orderBy('startedAt').toArray()
  const interrupted = new Set<string>()
  const runs = stored.map((r) => {
    if (r.outcome) return r
    interrupted.add(r.id)
    return restoreInterruptedRun(r)
  })
  if (interrupted.size) await simDb.runs.bulkPut(runs.filter((r) => interrupted.has(r.id)))
  return { runs, interrupted }
}

export async function clearRuns(): Promise<void> {
  await simDb.runs.clear()
}

// ---------------------------------------------------------------- conversation and preferences

export async function saveConversation(c: Omit<StoredConversation, 'id'>): Promise<void> {
  await simDb.conversation.put({ ...c, id: 'current' })
}

export async function loadConversation(): Promise<StoredConversation | undefined> {
  return simDb.conversation.get('current')
}

export async function clearConversation(): Promise<void> {
  await simDb.conversation.clear()
}

export async function savePrefs(p: Omit<StoredPrefs, 'id'>): Promise<void> {
  await simDb.prefs.put({ ...p, id: 'prefs' })
}

export async function loadPrefs(): Promise<StoredPrefs | undefined> {
  return simDb.prefs.get('prefs')
}
