/**
 * What the customer chat shows about a run, derived only from the run's trace
 * events (never from the reply text): the live tool steps, the "Sources" row,
 * the created ticket and whether the reply hands the customer over to a person.
 */
import type { SystemId } from '@shared/tools'
import type { RunRecord, TraceEvent } from '@/agent/types'
import type { ToolErrorCode, ToolResult } from '@/sim/tools'
import { recordKindOf, type RecordKind } from '@/features/systems/recordNav'

/**
 * `running`: started, no result yet; `awaiting`: waits for the customer's decision;
 * `ok`: success; `error`: a real failure; `neutral`: the call was not carried out
 * (`not_executed`) or its result was not recorded (`result_unknown`);
 * `warning`: rejected by the customer or a repeated call.
 */
export type StepStatus = 'running' | 'awaiting' | 'ok' | 'error' | 'neutral' | 'warning'

export interface StepView {
  callId: string
  seq: number
  name: string
  system: SystemId | null
  status: StepStatus
  code?: ToolErrorCode
  summary?: string
}

export interface Source {
  kind: RecordKind
  id: string
  label?: string
}

export interface RunView {
  steps: StepView[]
  sources: Source[]
  ticketId: string | null
  handover: boolean
  /** `run_finished.detail`: why the run ended without a normal answer (`RunEndReason`, e.g. `rate_limited`), null otherwise. */
  endReason: string | null
}

const NEUTRAL: readonly ToolErrorCode[] = ['not_executed', 'result_unknown']
const WARNING: readonly ToolErrorCode[] = ['rejected_by_user', 'duplicate_call']
/** Errors that mean the company system itself was unavailable (not an honest refusal like `forbidden`). */
const UNAVAILABLE: readonly ToolErrorCode[] = ['failed', 'index_not_ready']

export function stepStatusOf(r: ToolResult): StepStatus {
  if (r.ok) return 'ok'
  if (NEUTRAL.includes(r.error.code)) return 'neutral'
  if (WARNING.includes(r.error.code)) return 'warning'
  return 'error'
}

/** Tool calls of the run in `seq` order, with their current status. */
export function runSteps(events: readonly TraceEvent[]): StepView[] {
  const steps = new Map<string, StepView>()
  for (const e of events) {
    if (e.type === 'tool_started') steps.set(e.callId, { callId: e.callId, seq: e.seq, name: e.name, system: e.system, status: 'running' })
    else if (e.type === 'confirmation_requested') {
      const s = steps.get(e.callId)
      if (s && s.status === 'running') s.status = 'awaiting'
    } else if (e.type === 'confirmation_resolved') {
      const s = steps.get(e.callId)
      if (s && s.status === 'awaiting') s.status = 'running'
    } else if (e.type === 'tool_finished') {
      const s = steps.get(e.callId)
      if (!s) continue
      s.status = stepStatusOf(e.result)
      s.summary = e.result.summary
      if (!e.result.ok) s.code = e.result.error.code
      else delete s.code
    }
  }
  return [...steps.values()].sort((a, b) => a.seq - b.seq)
}

/** Successful results with the name of the tool that produced them, in the order they finished. */
function successes(events: readonly TraceEvent[]): { name: string; data: unknown }[] {
  const names = new Map<string, string>()
  const out: { name: string; data: unknown }[] = []
  for (const e of events) {
    if (e.type === 'tool_started') names.set(e.callId, e.name)
    else if (e.type === 'tool_finished' && e.result.ok) {
      const name = names.get(e.callId)
      if (name) out.push({ name, data: e.result.data })
    }
  }
  return out
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => x !== null) : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** The records one successful result is about (its primary IDs, not every ID it mentions). */
function sourcesOf(name: string, data: unknown): Source[] {
  const d = obj(data)
  const ids = (kind: RecordKind, values: unknown[], label?: (i: number) => string | undefined): Source[] =>
    values.flatMap((v, i) => {
      const id = str(v)
      if (!id || recordKindOf(id) !== kind) return []
      const l = label?.(i)
      return [l ? { kind, id, label: l } : { kind, id }]
    })
  switch (name) {
    case 'get_customer_profile':
      return ids('customer', [d?.customer_id])
    case 'get_customer_orders':
      return [...ids('order', list(d?.orders).map((o) => o.order_id)), ...ids('warranty', list(d?.transferred_units).map((u) => u.warranty_id))]
    case 'get_product_details':
      return ids('product', [d?.product_id], () => str(d?.model)?.replace(/^Northstar\s+/, '') ?? undefined)
    case 'check_warranty':
      return ids('warranty', [d?.warranty_id])
    case 'get_shipments':
      return ids('shipment', list(d?.shipments).map((s) => s.shipment_id))
    case 'track_shipment':
      return ids('shipment', [d?.shipment_id])
    case 'get_crm_history':
      return ids('interaction', list(d?.interactions).map((r) => r.interaction_id))
    case 'get_service_case':
      return ids('case', [d?.case_id])
    case 'create_service_ticket':
      return ids('ticket', [d?.ticket_id])
    case 'search_service_knowledge': {
      const hits = list(data)
      return ids('document', hits.map((h) => h.docId), (i) => str(hits[i]!.docTitle) ?? undefined)
    }
    default:
      return []
  }
}

/** The "Sources" row of a reply: records and documents the run's tools actually returned. */
export function runSources(events: readonly TraceEvent[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const { name, data } of successes(events)) {
    for (const s of sourcesOf(name, data)) {
      const key = `${s.kind}:${s.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

/** The ticket a successful `create_service_ticket` call created in this run, if any. */
export function ticketIdOf(events: readonly TraceEvent[]): string | null {
  for (const { name, data } of successes(events)) {
    if (name !== 'create_service_ticket') continue
    const id = str(obj(data)?.ticket_id)
    if (id) return id
  }
  return null
}

/**
 * The agent could not reach the company systems, so in a real deployment the
 * conversation would go to a human agent (in this lab nobody takes over; the
 * notice says so). Decided from structured facts only: the run has ended and was
 * not cancelled, no ticket was created, at least one tool ran and every tool that
 * ran failed because its company system was unavailable (`failed`,
 * `index_not_ready`). A run that ended on an error (Worker, network, rate limit,
 * quota) or a run limit shows only its own run notice; a refusal such as
 * `forbidden` is an honest answer, not a handover.
 */
export function handsOver(run: RunRecord): boolean {
  const finished = run.events.find((e): e is Extract<TraceEvent, { type: 'run_finished' }> => e.type === 'run_finished')
  const outcome = run.outcome ?? finished?.outcome
  if (!outcome || outcome === 'cancelled' || ticketIdOf(run.events) !== null) return false
  const ran = runSteps(run.events).filter((s) => s.status === 'ok' || s.status === 'error')
  return ran.length > 0 && ran.every((s) => s.status === 'error' && s.code !== undefined && UNAVAILABLE.includes(s.code))
}

/** Why the run ended (the `run_finished.detail` code), or null while it runs or when it simply answered. */
export function endReasonOf(events: readonly TraceEvent[]): string | null {
  for (const e of events) if (e.type === 'run_finished') return e.detail ?? null
  return null
}

export function runView(run: RunRecord | undefined): RunView {
  if (!run) return { steps: [], sources: [], ticketId: null, handover: false, endReason: null }
  return { steps: runSteps(run.events), sources: runSources(run.events), ticketId: ticketIdOf(run.events), handover: handsOver(run), endReason: endReasonOf(run.events) }
}

/**
 * Whether a message filled in from a scenario still counts as that scenario: only
 * while the draft is the scenario text (an edited question is the learner's own).
 */
export function draftKeepsScenario(draft: string, scenarioMessage: string | undefined): boolean {
  return !!scenarioMessage && draft.trim() === scenarioMessage.trim()
}
