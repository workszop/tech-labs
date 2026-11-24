import { describe, expect, it } from 'vitest'
import { TOOL_NAMES, type SystemId, type ToolName } from '@shared/tools'
import type { TraceEvent } from '@/agent/types'
import type { ToolResult } from '@/sim/tools'
import { deriveTrace, highlightedNode, isOff, itemsOfNode } from './trace'

const ALL = [...TOOL_NAMES]
const usage = { inputTokens: 100, outputTokens: 20 }
const ok = (summary: string, data: unknown = {}): ToolResult => ({ ok: true, data, summary })
const err = (code: Extract<ToolResult, { ok: false }>['error']['code'], message = 'msg'): ToolResult => ({ ok: false, error: { code, message }, summary: code })

function started(step: number, callId: string, seq: number, name: string, system: SystemId | null, at = 10, readOnly = true): TraceEvent {
  return { type: 'tool_started', step, callId, seq, name, system, readOnly, args: { id: callId }, at }
}
const finished = (callId: string, result: ToolResult, durationMs = 5, at = 20): TraceEvent => ({ type: 'tool_finished', callId, at, durationMs, result })

/** Scenario 1 shape: one call, then two read-only calls in parallel, then the final answer. */
function scenario1(): TraceEvent[] {
  return [
    { type: 'run_started', runId: 'r1', at: 0, customerId: 'CUST-1042', message: 'E04', enabledTools: ALL },
    { type: 'model_started', step: 1, at: 1 },
    { type: 'model_finished', step: 1, at: 2, durationMs: 900, kind: 'tool_calls', text: '', usage, forcedFinal: false },
    started(1, 'c1', 1, 'get_customer_orders', 'orders'),
    finished('c1', ok('2 orders')),
    { type: 'model_started', step: 2, at: 30 },
    { type: 'model_finished', step: 2, at: 31, durationMs: 800, kind: 'tool_calls', text: 'Checking.', usage, forcedFinal: false },
    started(2, 'c2', 2, 'check_warranty', 'warranty'),
    started(2, 'c3', 3, 'search_service_knowledge', 'knowledge'),
    finished('c3', ok('5 chunks', [])),
    finished('c2', ok('Warranty active')),
    { type: 'model_started', step: 3, at: 50 },
    { type: 'model_finished', step: 3, at: 51, durationMs: 1200, kind: 'final', text: 'Answer', usage, forcedFinal: false },
    { type: 'run_finished', at: 52, outcome: 'answered', answer: 'Answer' },
  ]
}

describe('deriveTrace', () => {
  it('builds timeline rows in event order with ids, steps and the next-call marker', () => {
    const t = deriveTrace(scenario1(), ALL)
    expect(t.items.map((i) => i.id)).toEqual(['customer', 'model:1', 'tool:c1', 'model:2', 'tool:c2', 'tool:c3', 'model:3', 'final'])
    const c1 = t.calls.find((c) => c.callId === 'c1')!
    expect(c1.next).toBe(2)
    expect(t.calls.find((c) => c.callId === 'c3')!.next).toBe('last')
    expect(t.finished).toBe(true)
    expect(t.totalTokens).toBe(360)
  })

  it('marks the two calls of step 2 as parallel and the single call as not parallel', () => {
    const t = deriveTrace(scenario1(), ALL)
    expect(t.calls.find((c) => c.callId === 'c1')!.parallel).toBe(1)
    expect(t.calls.find((c) => c.callId === 'c2')!.parallel).toBe(2)
    expect(t.calls.find((c) => c.callId === 'c3')!.parallel).toBe(2)
  })

  it('derives node states only from the events: done systems, idle systems, agent and final done', () => {
    const t = deriveTrace(scenario1(), ALL)
    expect(t.systems.orders.status).toBe('done')
    expect(t.systems.knowledge.status).toBe('done')
    expect(t.systems.knowledge.last?.result?.summary).toBe('5 chunks')
    expect(t.systems.crm.status).toBe('idle')
    expect(t.agent.status).toBe('done')
    expect(t.agent.step).toBe(3)
    expect(t.final.status).toBe('done')
    expect(t.customer.status).toBe('done')
  })

  it('a replay prefix shows the running call as active and the next marker as unknown', () => {
    const t = deriveTrace(scenario1().slice(0, 9), ALL) // up to the second parallel tool_started
    expect(t.systems.warranty.status).toBe('active')
    expect(t.systems.knowledge.status).toBe('active')
    expect(t.calls.find((c) => c.callId === 'c3')!.next).toBeNull()
    expect(t.final.status).toBe('idle')
    expect(t.finished).toBe(false)
    expect(t.agent.phase).toBe('tools')
  })

  it('a model turn in progress makes the agent active', () => {
    const t = deriveTrace(scenario1().slice(0, 2), ALL)
    expect(t.agent.status).toBe('active')
    expect(t.agent.phase).toBe('model')
    const turn = t.items.find((i) => i.id === 'model:1')
    expect(turn?.kind === 'model' && turn.turn.status).toBe('running')
  })

  it('a forbidden call is a red error with the tool message', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r9', at: 0, customerId: 'CUST-1001', message: 'x', enabledTools: ALL },
      { type: 'model_started', step: 1, at: 1 },
      { type: 'model_finished', step: 1, at: 2, durationMs: 1, kind: 'tool_calls', text: '', usage, forcedFinal: false },
      started(1, 'c1', 1, 'get_shipments', 'logistics'),
      finished('c1', err('forbidden', 'Access denied: the requested order is not linked')),
    ]
    const t = deriveTrace(events, ALL)
    const c = t.calls[0]!
    expect(c.status).toBe('error')
    expect(c.durationMs).toBe(5)
    expect(t.systems.logistics.status).toBe('error')
    expect(t.systems.logistics.errors).toBe(1)
  })

  it('a pending confirmation puts the ticket system in the waiting state with a confirmation row', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r8', at: 0, customerId: 'CUST-1005', message: 'x', enabledTools: ALL },
      { type: 'model_started', step: 1, at: 1 },
      { type: 'model_finished', step: 1, at: 2, durationMs: 1, kind: 'tool_calls', text: '', usage, forcedFinal: false },
      started(1, 't1', 1, 'create_service_ticket', 'tickets', 10, false),
      { type: 'confirmation_requested', callId: 't1', at: 11 },
    ]
    const t = deriveTrace(events, ALL)
    expect(t.systems.tickets.status).toBe('waiting')
    expect(t.agent.phase).toBe('approval')
    expect(t.items.map((i) => i.id)).toContain('confirm:t1')
    const call = t.calls[0]!
    expect(call.status).toBe('waiting')
    expect(call.confirmation?.state).toBe('pending')
  })

  it('a restored run shows the undecided call as not run, with no duration, in a neutral state', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r8', at: 0, customerId: 'CUST-1005', message: 'x', enabledTools: ALL },
      { type: 'model_started', step: 1, at: 1 },
      { type: 'model_finished', step: 1, at: 2, durationMs: 1, kind: 'tool_calls', text: '', usage, forcedFinal: false },
      started(1, 't1', 1, 'create_service_ticket', 'tickets', 10, false),
      { type: 'confirmation_requested', callId: 't1', at: 11 },
      finished('t1', err('not_executed', 'Nothing was executed'), 0, 11),
      { type: 'run_finished', at: 11, outcome: 'cancelled', detail: 'reload', answer: '' },
    ]
    const t = deriveTrace(events, ALL)
    const call = t.calls[0]!
    expect(call.status).toBe('neutral')
    expect(call.durationMs).toBeNull()
    expect(call.confirmation?.state).toBe('none')
    expect(t.systems.tickets.status).toBe('neutral')
    expect(t.systems.tickets.errors).toBe(0)
    expect(t.final.status).toBe('warning')
    expect(t.agent.status).toBe('warning')
  })

  it('approved and rejected confirmations', () => {
    const base: TraceEvent[] = [
      { type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: ALL },
      started(1, 't1', 1, 'create_service_ticket', 'tickets', 10, false),
      { type: 'confirmation_requested', callId: 't1', at: 11 },
    ]
    const approved = deriveTrace([...base, { type: 'confirmation_resolved', callId: 't1', approved: true, at: 12 }], ALL)
    expect(approved.calls[0]!.status).toBe('running')
    expect(approved.calls[0]!.confirmation?.state).toBe('approved')
    expect(approved.systems.tickets.status).toBe('active')
    const rejected = deriveTrace([...base, { type: 'confirmation_resolved', callId: 't1', approved: false, at: 12 }, finished('t1', err('rejected_by_user'), 0)], ALL)
    expect(rejected.calls[0]!.status).toBe('warning')
    expect(rejected.calls[0]!.durationMs).toBeNull()
    expect(rejected.systems.tickets.status).toBe('warning')
  })

  it('result_unknown is neutral and has no duration; never-run calls do not count as parallel', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: ALL },
      started(1, 'x1', 1, 'nonsense_tool', null),
      started(1, 'c1', 2, 'get_crm_history', 'crm'),
      finished('x1', err('unknown_tool'), 0),
      finished('c1', err('result_unknown'), 0),
      { type: 'run_finished', at: 30, outcome: 'cancelled', detail: 'cancelled', answer: '' },
    ]
    const t = deriveTrace(events, ALL)
    const [x1, c1] = t.calls
    expect(c1!.status).toBe('neutral')
    expect(c1!.durationMs).toBeNull()
    expect(c1!.parallel).toBe(1)
    expect(x1!.status).toBe('error')
    expect(x1!.durationMs).toBeNull()
    // a rejected call without a system belongs to the agent node, not to a system node
    expect(t.agent.rejected.map((c) => c.callId)).toEqual(['x1'])
    expect(Object.values(t.systems).flatMap((s) => s.calls.map((c) => c.callId))).toEqual(['c1'])
    expect(highlightedNode(t, 'tool:x1')).toBe('agent')
  })

  it('an interrupted model turn is shown as without reply', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: ALL },
      { type: 'model_started', step: 1, at: 1 },
      { type: 'run_finished', at: 30, outcome: 'cancelled', detail: 'cancelled', answer: '' },
    ]
    const t = deriveTrace(events, ALL)
    const turn = t.items.find((i) => i.id === 'model:1')
    expect(turn?.kind === 'model' && turn.turn.status).toBe('interrupted')
    expect(t.agent.status).toBe('warning')
  })

  it('a system whose every tool is disabled in the run is off', () => {
    const enabled = ALL.filter((n) => n !== 'get_shipments' && n !== 'track_shipment') as ToolName[]
    const t = deriveTrace([{ type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: enabled }], ALL)
    expect(t.systems.logistics.off).toBe(true)
    expect(t.systems.crm.off).toBe(false)
    // without a run the fallback switches apply
    expect(deriveTrace([], enabled).systems.logistics.off).toBe(true)
    expect(isOff('tickets', ['create_service_ticket'])).toBe(false)
    expect(isOff('tickets', [])).toBe(true)
  })

  it('maps selections to the highlighted node and nodes to their timeline rows', () => {
    const t = deriveTrace(scenario1(), ALL)
    expect(highlightedNode(t, 'tool:c3')).toBe('knowledge')
    expect(highlightedNode(t, 'model:2')).toBe('agent')
    expect(highlightedNode(t, 'customer')).toBe('customer')
    expect(highlightedNode(t, 'final')).toBe('final')
    expect(highlightedNode(t, 'node:crm')).toBe('crm')
    expect(highlightedNode(t, null)).toBeNull()
    expect(itemsOfNode(t, 'warranty')).toEqual(['tool:c2'])
    expect(itemsOfNode(t, 'agent')).toEqual(['model:1', 'model:2', 'model:3'])
  })

  it('a rejected confirmation is not running while the rejection result is pending', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: ALL },
      started(1, 't1', 1, 'create_service_ticket', 'tickets', 10, false),
      { type: 'confirmation_requested', callId: 't1', at: 11 },
      { type: 'confirmation_resolved', callId: 't1', approved: false, at: 12 },
    ]
    const t = deriveTrace(events, ALL)
    expect(t.calls[0]!.status).toBe('warning')
    expect(t.systems.tickets.status).toBe('warning')
  })

  it('a finished run never shows an open call as active or waiting', () => {
    const events: TraceEvent[] = [
      { type: 'run_started', runId: 'r', at: 0, customerId: 'C', message: 'x', enabledTools: ALL },
      started(1, 'c1', 1, 'get_crm_history', 'crm'),
      started(1, 't1', 2, 'create_service_ticket', 'tickets', 10, false),
      { type: 'confirmation_requested', callId: 't1', at: 11 },
      { type: 'run_finished', at: 30, outcome: 'cancelled', detail: 'cancelled', answer: '' },
    ]
    const t = deriveTrace(events, ALL)
    expect(t.calls.map((c) => c.status)).toEqual(['neutral', 'neutral'])
    expect(t.calls.every((c) => c.durationMs === null)).toBe(true)
    expect(t.calls[1]!.confirmation?.state).toBe('none')
    expect(t.systems.crm.status).toBe('neutral')
    expect(t.systems.tickets.status).toBe('neutral')
  })
})
