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

const RELOAD_SUMMARY: Record<Lang, string> = {
  en: 'Interrupted by a page reload; not executed',
  pl: 'Przerwane przez odświeżenie strony; nie wykonano',
}

/**
 * Closes a run that has no outcome: every started tool without a result gets a
 * `failed` result (it was not executed, or its result was lost), then the run
 * ends as `cancelled` with reason `reload`. Finished runs are returned unchanged.
 */
export function restoreInterruptedRun(run: RunRecord, now: number): RunRecord {
  if (run.outcome) return run
  const events: TraceEvent[] = [...run.events]
  const done = new Set(events.flatMap((e) => (e.type === 'tool_finished' ? [e.callId] : [])))
  for (const e of run.events) {
    if (e.type !== 'tool_started' || done.has(e.callId)) continue
    const result: ToolResult = {
      ok: false,
      error: { code: 'failed', message: 'The page was reloaded before this call finished. Nothing was executed.' },
      summary: RELOAD_SUMMARY[run.lang],
    }
    events.push({ type: 'tool_finished', callId: e.callId, at: now, durationMs: Math.max(0, now - e.at), result })
  }
  if (events.at(-1)?.type !== 'run_finished') events.push({ type: 'run_finished', at: now, outcome: 'cancelled', detail: 'reload', answer: '' })
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
export async function loadRuns(now = Date.now()): Promise<{ runs: RunRecord[]; interrupted: Set<string> }> {
  await pruneRuns()
  const stored = await simDb.runs.orderBy('startedAt').toArray()
  const interrupted = new Set<string>()
  const runs = stored.map((r) => {
    if (r.outcome) return r
    interrupted.add(r.id)
    return restoreInterruptedRun(r, now)
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
