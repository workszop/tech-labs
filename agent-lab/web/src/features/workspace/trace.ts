/**
 * Pure view model of one agent run for the centre panel. Every timeline row, node
 * state and number here is derived from the run's recorded `TraceEvent`s (or a
 * prefix of them during a replay); nothing is invented or animated without an
 * event that says so.
 */
import type { ChatUsage } from '@shared/api-types'
import { TOOLS, type SystemId, type ToolName } from '@shared/tools'
import type { RunOutcome, TraceEvent } from '@/agent/types'
import type { ToolErrorCode, ToolResult } from '@/sim/tools'

export const SYSTEM_IDS: readonly SystemId[] = ['orders', 'products', 'warranty', 'logistics', 'crm', 'knowledge', 'tickets']
export type NodeId = 'customer' | 'agent' | SystemId | 'final'

/**
 * State of a tool call:
 * - `running`: started (or approved), no result yet;
 * - `waiting`: a confirmation was requested and not decided;
 * - `ok`: a result came back;
 * - `error`: a real failure (the tool refused or failed, or the call was rejected as invalid);
 * - `warning`: the user rejected it, or it repeated an earlier identical call (not run);
 * - `neutral`: not run (`not_executed`) or result not recorded (`result_unknown`); not a failure.
 */
export type CallStatus = 'running' | 'waiting' | 'ok' | 'error' | 'warning' | 'neutral'
export type NodeStatus = 'idle' | 'active' | 'waiting' | 'done' | 'error' | 'warning' | 'neutral'

const WARNING_CODES: readonly ToolErrorCode[] = ['rejected_by_user', 'duplicate_call']
const NEUTRAL_CODES: readonly ToolErrorCode[] = ['not_executed', 'result_unknown']
/** Codes of calls that were never carried out by a tool, so they have no duration. */
const NEVER_RAN: readonly ToolErrorCode[] = ['not_executed', 'result_unknown', 'rejected_by_user', 'duplicate_call', 'unknown_tool', 'tool_disabled', 'too_many_calls']

export function statusOfResult(r: ToolResult): CallStatus {
  if (r.ok) return 'ok'
  if (WARNING_CODES.includes(r.error.code)) return 'warning'
  if (NEUTRAL_CODES.includes(r.error.code)) return 'neutral'
  return 'error'
}

export interface CallView {
  callId: string
  seq: number
  step: number
  name: string
  system: SystemId | null
  readOnly: boolean
  args: Record<string, unknown>
  startedAt: number
  status: CallStatus
  result?: ToolResult
  /** `null`: the call was not carried out by a tool (or its result was not recorded), so there is no duration. */
  durationMs: number | null
  finishedAt?: number
  /** `none`: a confirmation was requested but no decision was recorded (cancel or reload). */
  confirmation?: { requestedAt: number; state: 'pending' | 'approved' | 'rejected' | 'none'; resolvedAt?: number }
  /** How many calls of the same step were running at the same time as this one (itself included). */
  parallel: number
  /** Sequence number of the next call of the run, `'last'` when none followed, `null` while that is not known yet. */
  next: number | 'last' | null
}

export interface ModelTurnView {
  step: number
  startedAt: number
  /** `interrupted`: the run ended before the model answered. */
  status: 'running' | 'done' | 'interrupted'
  durationMs?: number
  kind?: 'tool_calls' | 'final'
  text?: string
  usage?: ChatUsage
  forcedFinal?: boolean
}

export type TimelineItem =
  | { id: 'customer'; kind: 'customer'; at: number; message: string; customerId: string; enabledTools: ToolName[] }
  | { id: `model:${number}`; kind: 'model'; turn: ModelTurnView }
  | { id: `tool:${string}`; kind: 'tool'; call: CallView }
  | { id: `confirm:${string}`; kind: 'confirm'; call: CallView }
  | { id: 'final'; kind: 'final'; at: number; outcome: RunOutcome; detail?: string; answer: string }

export interface SystemNodeView {
  id: SystemId
  status: NodeStatus
  /** Every tool of this system was switched off for the run. */
  off: boolean
  calls: CallView[]
  /** The call that finished last (or the one in progress). */
  last?: CallView
  errors: number
}

/** What the agent is doing while the run is in progress. */
export type AgentPhase = 'idle' | 'model' | 'tools' | 'approval' | 'finished'

export interface TraceView {
  started: boolean
  finished: boolean
  startedAt: number | null
  enabledTools: ToolName[]
  items: TimelineItem[]
  calls: CallView[]
  turns: ModelTurnView[]
  totalTokens: number
  customer: { status: NodeStatus; message?: string; customerId?: string }
  agent: { status: NodeStatus; phase: AgentPhase; step: number | null; rejected: CallView[] }
  systems: Record<SystemId, SystemNodeView>
  final: { status: NodeStatus; outcome?: RunOutcome; detail?: string; answer?: string }
}

export function isOff(system: SystemId, enabledTools: readonly string[]): boolean {
  return TOOLS.filter((t) => t.system === system).every((t) => !enabledTools.includes(t.name))
}

const OUTCOME_STATUS: Record<RunOutcome, NodeStatus> = { answered: 'done', cancelled: 'warning', limit: 'warning', error: 'error' }

/**
 * Derives the view of a run from its events. `fallbackTools` are the tool
 * switches used when the events hold no `run_started` (no run selected).
 */
export function deriveTrace(events: readonly TraceEvent[], fallbackTools: readonly ToolName[]): TraceView {
  const runStart = events.find((e) => e.type === 'run_started')
  const runEnd = events.find((e) => e.type === 'run_finished')
  const finished = !!runEnd
  const enabledTools = runStart ? [...runStart.enabledTools] : [...fallbackTools]

  const turns = new Map<number, ModelTurnView>()
  const calls = new Map<string, CallView & { startIdx: number; endIdx: number | null }>()
  const items: TimelineItem[] = []

  events.forEach((e, idx) => {
    switch (e.type) {
      case 'run_started':
        items.push({ id: 'customer', kind: 'customer', at: e.at, message: e.message, customerId: e.customerId, enabledTools: [...e.enabledTools] })
        break
      case 'model_started': {
        const turn: ModelTurnView = { step: e.step, startedAt: e.at, status: 'running' }
        turns.set(e.step, turn)
        items.push({ id: `model:${e.step}`, kind: 'model', turn })
        break
      }
      case 'model_finished': {
        let turn = turns.get(e.step)
        if (!turn) {
          turn = { step: e.step, startedAt: e.at - e.durationMs, status: 'running' }
          turns.set(e.step, turn)
          items.push({ id: `model:${e.step}`, kind: 'model', turn })
        }
        Object.assign(turn, { status: 'done', durationMs: e.durationMs, kind: e.kind, text: e.text, usage: e.usage, forcedFinal: e.forcedFinal })
        break
      }
      case 'tool_started': {
        const call = {
          callId: e.callId, seq: e.seq, step: e.step, name: e.name, system: e.system, readOnly: e.readOnly, args: e.args, startedAt: e.at,
          status: 'running' as CallStatus, durationMs: null, parallel: 1, next: null, startIdx: idx, endIdx: null,
        }
        calls.set(e.callId, call)
        items.push({ id: `tool:${e.callId}`, kind: 'tool', call })
        break
      }
      case 'confirmation_requested': {
        const call = calls.get(e.callId)
        if (!call) break
        call.confirmation = { requestedAt: e.at, state: 'pending' }
        call.status = 'waiting'
        items.push({ id: `confirm:${e.callId}`, kind: 'confirm', call })
        break
      }
      case 'confirmation_resolved': {
        const call = calls.get(e.callId)
        if (!call?.confirmation) break
        call.confirmation.state = e.approved ? 'approved' : 'rejected'
        call.confirmation.resolvedAt = e.at
        // Approved: the tool runs now. Rejected: it never runs; the rejection result follows.
        call.status = e.approved ? 'running' : 'warning'
        break
      }
      case 'tool_finished': {
        const call = calls.get(e.callId)
        if (!call) break
        call.result = e.result
        call.finishedAt = e.at
        call.endIdx = idx
        call.status = statusOfResult(e.result)
        call.durationMs = neverRan(e.result, e.durationMs) ? null : e.durationMs
        if (call.confirmation?.state === 'pending') call.confirmation.state = 'none'
        break
      }
      case 'run_finished':
        items.push({ id: 'final', kind: 'final', at: e.at, outcome: e.outcome, ...(e.detail ? { detail: e.detail } : {}), answer: e.answer })
        break
    }
  })

  if (finished) {
    for (const t of turns.values()) if (t.status === 'running') t.status = 'interrupted'
    // Defensive: a finished run with a call that has no result (restore normally closes these)
    // shows it as "result not recorded", never as running or awaiting approval.
    for (const c of calls.values()) {
      if (c.result) continue
      c.status = 'neutral'
      if (c.confirmation?.state === 'pending') c.confirmation.state = 'none'
    }
  }

  // Parallel: calls of one step that were carried out and whose start..finish intervals overlap.
  const list = [...calls.values()].sort((a, b) => a.seq - b.seq)
  const ran = list.filter((c) => (c.result ? c.durationMs !== null : !finished))
  for (const c of ran) {
    const end = c.endIdx ?? Number.POSITIVE_INFINITY
    c.parallel = ran.filter((o) => o.step === c.step && o.startIdx < end && c.startIdx < (o.endIdx ?? Number.POSITIVE_INFINITY)).length
  }
  list.forEach((c, i) => {
    const after = list[i + 1]
    c.next = after ? after.seq : finished ? 'last' : null
  })

  const systems = {} as Record<SystemId, SystemNodeView>
  for (const id of SYSTEM_IDS) {
    const own = list.filter((c) => c.system === id)
    systems[id] = { id, status: nodeStatusOf(own), off: isOff(id, enabledTools), calls: own, last: lastOf(own), errors: own.filter((c) => c.status === 'error').length }
  }

  const turnList = [...turns.values()].sort((a, b) => a.step - b.step)
  const lastTurn = turnList.at(-1)
  const phase: AgentPhase = !runStart
    ? 'idle'
    : finished
      ? 'finished'
      : lastTurn?.status === 'running'
        ? 'model'
        : list.some((c) => c.status === 'waiting')
          ? 'approval'
          : 'tools'
  const agentStatus: NodeStatus = !runStart ? 'idle' : runEnd ? OUTCOME_STATUS[runEnd.outcome] : phase === 'model' ? 'active' : 'idle'

  return {
    started: !!runStart,
    finished,
    startedAt: runStart?.at ?? null,
    enabledTools,
    items,
    calls: list,
    turns: turnList,
    totalTokens: turnList.reduce((n, t) => n + (t.usage ? t.usage.inputTokens + t.usage.outputTokens : 0), 0),
    customer: runStart ? { status: 'done', message: runStart.message, customerId: runStart.customerId } : { status: 'idle' },
    agent: { status: agentStatus, phase, step: lastTurn?.step ?? null, rejected: list.filter((c) => c.system === null) },
    systems,
    final: runEnd
      ? { status: OUTCOME_STATUS[runEnd.outcome], outcome: runEnd.outcome, ...(runEnd.detail ? { detail: runEnd.detail } : {}), answer: runEnd.answer }
      : { status: 'idle' },
  }
}

function neverRan(r: ToolResult, durationMs: number): boolean {
  if (r.ok) return false
  if (NEVER_RAN.includes(r.error.code)) return true
  // Calls the Worker rejected as invalid are answered at once, without a tool: 0 ms.
  return r.error.code === 'invalid_arguments' && durationMs === 0
}

function nodeStatusOf(calls: (CallView & { endIdx: number | null })[]): NodeStatus {
  if (calls.some((c) => c.status === 'waiting')) return 'waiting'
  if (calls.some((c) => c.status === 'running')) return 'active'
  const last = lastOf(calls)
  if (!last) return 'idle'
  return ({ ok: 'done', error: 'error', warning: 'warning', neutral: 'neutral', running: 'active', waiting: 'waiting' } as const)[last.status]
}

function lastOf<T extends CallView & { endIdx: number | null }>(calls: T[]): T | undefined {
  const open = calls.find((c) => c.endIdx === null)
  if (open) return open
  return [...calls].sort((a, b) => (a.endIdx ?? 0) - (b.endIdx ?? 0)).at(-1)
}

/** The graph node that a selected timeline item or node belongs to. */
export function highlightedNode(t: TraceView, itemId: string | null): NodeId | null {
  if (!itemId) return null
  if (itemId.startsWith('node:')) return itemId.slice(5) as NodeId
  if (itemId === 'customer' || itemId === 'final') return itemId
  if (itemId.startsWith('model:')) return 'agent'
  const callId = itemId.replace(/^(tool|confirm):/, '')
  const call = t.calls.find((c) => c.callId === callId)
  return call ? (call.system ?? 'agent') : null
}

/** Timeline rows that belong to a node (marked in the timeline when the node is selected). */
export function itemsOfNode(t: TraceView, node: NodeId): string[] {
  return t.items
    .filter((i) => {
      if (node === 'customer') return i.kind === 'customer'
      if (node === 'final') return i.kind === 'final'
      if (node === 'agent') return i.kind === 'model' || ((i.kind === 'tool' || i.kind === 'confirm') && i.call.system === null)
      return (i.kind === 'tool' || i.kind === 'confirm') && i.call.system === node
    })
    .map((i) => i.id)
}
