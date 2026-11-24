import { describe, expect, it } from 'vitest'
import type { RunRecord, TraceEvent } from '@/agent/types'
import type { SystemId } from '@shared/tools'
import type { ToolResult } from '@/sim/tools'
import type { KnowledgeHit } from '@/data/kb/types'
import { runSources, runSteps, runView, stepStatusOf, ticketIdOf, handsOver } from './model'

let seq = 0
function started(callId: string, name: string, system: SystemId | null = 'orders'): TraceEvent {
  return { type: 'tool_started', step: 1, callId, seq: ++seq, name, system, readOnly: name !== 'create_service_ticket', args: {}, at: 1 }
}
function finished(callId: string, result: ToolResult): TraceEvent {
  return { type: 'tool_finished', callId, at: 2, durationMs: 1, result }
}
const ok = (data: unknown): ToolResult => ({ ok: true, data, summary: 'ok' })
const err = (code: Extract<ToolResult, { ok: false }>['error']['code']): ToolResult => ({ ok: false, error: { code, message: code }, summary: code })
const runStart: TraceEvent = { type: 'run_started', runId: 'r1', at: 0, customerId: 'CUST-1042', message: 'hi', enabledTools: [] }
const final = (outcome: 'answered' | 'cancelled' | 'limit' | 'error'): TraceEvent => ({ type: 'run_finished', at: 9, outcome, answer: 'x' })

function run(events: TraceEvent[], outcome?: RunRecord['outcome']): RunRecord {
  return { id: 'r1', scenarioId: null, customerId: 'CUST-1042', message: 'hi', enabledTools: [], startedAt: 0, events, model: 'm', lang: 'en', ...(outcome ? { outcome } : {}) }
}

const HIT = (docId: string, docTitle: string): KnowledgeHit => ({ chunkId: `${docId}#1`, docId, docTitle, section: 's', text: 't', score: 0.9, authority: 'manual', status: 'current', appliesTo: [], effectiveDate: '2026-01-01' })

describe('step status', () => {
  it('classifies results: success, real errors, neutral "did not run", warnings', () => {
    expect(stepStatusOf(ok({}))).toBe('ok')
    for (const c of ['failed', 'forbidden', 'not_found', 'invalid_arguments', 'unknown_tool', 'tool_disabled', 'too_many_calls', 'index_not_ready'] as const) expect(stepStatusOf(err(c))).toBe('error')
    expect(stepStatusOf(err('not_executed'))).toBe('neutral')
    expect(stepStatusOf(err('result_unknown'))).toBe('neutral')
    expect(stepStatusOf(err('rejected_by_user'))).toBe('warning')
    expect(stepStatusOf(err('duplicate_call'))).toBe('warning')
  })

  it('lists steps in seq order with running and awaiting states', () => {
    const steps = runSteps([
      runStart,
      started('a', 'get_customer_orders'),
      started('b', 'check_warranty', 'warranty'),
      finished('b', ok({ warranty_id: 'WAR-0031' })),
      started('t', 'create_service_ticket', 'tickets'),
      { type: 'confirmation_requested', callId: 't', at: 3 },
    ])
    expect(steps.map((s) => [s.callId, s.status])).toEqual([['a', 'running'], ['b', 'ok'], ['t', 'awaiting']])
    expect(steps[1]!.system).toBe('warranty')
  })

  it('keeps the error code of a failed step', () => {
    const [s] = runSteps([started('a', 'get_shipments', 'logistics'), finished('a', err('forbidden'))])
    expect(s).toMatchObject({ status: 'error', code: 'forbidden' })
  })
})

describe('sources', () => {
  it('come only from successful tool results: record IDs and document titles, deduplicated', () => {
    const sources = runSources([
      started('a', 'get_customer_orders'),
      finished('a', ok({ customer_id: 'CUST-1042', orders: [{ order_id: 'ORD-2026-0187', items: [] }, { order_id: 'ORD-2025-0042', items: [] }] })),
      started('b', 'check_warranty', 'warranty'),
      finished('b', ok({ warranty_id: 'WAR-0031', product_id: 'PRD-COFFEE-1' })),
      started('c', 'search_service_knowledge', 'knowledge'),
      finished('c', ok([HIT('DOC-e04', 'E04 troubleshooting'), HIT('DOC-e04', 'E04 troubleshooting'), HIT('DOC-policy', 'Warranty policy')])),
      started('d', 'track_shipment', 'logistics'),
      finished('d', err('forbidden')),
      started('e', 'get_service_case', 'tickets'),
      finished('e', err('result_unknown')),
    ])
    expect(sources).toEqual([
      { kind: 'order', id: 'ORD-2026-0187' },
      { kind: 'order', id: 'ORD-2025-0042' },
      { kind: 'warranty', id: 'WAR-0031' },
      { kind: 'document', id: 'DOC-e04', label: 'E04 troubleshooting' },
      { kind: 'document', id: 'DOC-policy', label: 'Warranty policy' },
    ])
  })

  it('cover every read tool and the created ticket', () => {
    const sources = runSources([
      started('1', 'get_customer_profile', 'crm'), finished('1', ok({ customer_id: 'CUST-1042', name: 'Emma' })),
      started('2', 'get_product_details', 'products'), finished('2', ok({ product_id: 'PRD-COFFEE-1', model: 'Northstar Barista Pro 500' })),
      started('3', 'get_shipments', 'logistics'), finished('3', ok({ shipments: [{ shipment_id: 'SHIP-2026-023' }] })),
      started('4', 'track_shipment', 'logistics'), finished('4', ok({ shipment_id: 'SHIP-2026-023' })),
      started('5', 'get_crm_history', 'crm'), finished('5', ok({ interactions: [{ interaction_id: 'INT-0016' }] })),
      started('6', 'get_service_case', 'tickets'), finished('6', ok({ case_id: 'CASE-2026-004' })),
      started('7', 'create_service_ticket', 'tickets'), finished('7', ok({ ticket_id: 'TCK-2026-0001' })),
    ])
    expect(sources.map((s) => s.id)).toEqual(['CUST-1042', 'PRD-COFFEE-1', 'SHIP-2026-023', 'INT-0016', 'CASE-2026-004', 'TCK-2026-0001'])
    expect(sources.find((s) => s.id === 'PRD-COFFEE-1')).toEqual({ kind: 'product', id: 'PRD-COFFEE-1', label: 'Barista Pro 500' })
  })

  it('ignore malformed data and IDs that are not Northstar record IDs', () => {
    const sources = runSources([
      started('a', 'get_customer_orders'), finished('a', ok({ orders: [{ order_id: 'nonsense' }, null, 7] })),
      started('b', 'search_service_knowledge', 'knowledge'), finished('b', ok({ not: 'a list' })),
      started('c', 'unknown_thing', null), finished('c', ok({ order_id: 'ORD-2026-0001' })),
    ])
    expect(sources).toEqual([])
  })

  it('are empty when no tool succeeded', () => {
    expect(runSources([started('a', 'get_shipments', 'logistics'), finished('a', err('forbidden'))])).toEqual([])
    expect(runSources([])).toEqual([])
  })
})

describe('escalation', () => {
  it('reports the ticket only from a successful create_service_ticket result', () => {
    expect(ticketIdOf([started('t', 'create_service_ticket', 'tickets'), finished('t', ok({ ticket_id: 'TCK-2026-0002' }))])).toBe('TCK-2026-0002')
    expect(ticketIdOf([started('t', 'create_service_ticket', 'tickets'), finished('t', err('rejected_by_user'))])).toBeNull()
    expect(ticketIdOf([started('t', 'create_service_ticket', 'tickets'), finished('t', err('result_unknown'))])).toBeNull()
  })

  it('does not hand over just because the run ended on an error or a limit', () => {
    // error with no tools, Worker rate limit, quota, run limit, cancel, plain answer: their own notice only
    expect(handsOver(run([runStart, final('error')], 'error'))).toBe(false)
    const rateLimited: TraceEvent = { type: 'run_finished', at: 9, outcome: 'error', detail: 'rate_limited', answer: '' }
    expect(handsOver(run([runStart, rateLimited], 'error'))).toBe(false)
    const quota: TraceEvent = { type: 'run_finished', at: 9, outcome: 'error', detail: 'quota_exceeded', answer: '' }
    expect(handsOver(run([runStart, quota], 'error'))).toBe(false)
    expect(handsOver(run([runStart, final('limit')], 'limit'))).toBe(false)
    const okThenLimit = [runStart, started('a', 'get_customer_orders'), finished('a', ok({ orders: [] })), final('limit')]
    expect(handsOver(run(okThenLimit, 'limit'))).toBe(false)
    expect(handsOver(run([runStart, final('cancelled')], 'cancelled'))).toBe(false)
    expect(handsOver(run([runStart, final('answered')], 'answered'))).toBe(false)
  })

  it('hands over when every tool that ran hit an unavailable system, whatever the run outcome except a cancel', () => {
    const failedAll = [runStart, started('a', 'get_customer_orders'), finished('a', err('failed'))]
    expect(handsOver(run([...failedAll, final('error')], 'error'))).toBe(true)
    expect(handsOver(run([...failedAll, final('limit')], 'limit'))).toBe(true)
    expect(handsOver(run([...failedAll, final('cancelled')], 'cancelled'))).toBe(false)
  })

  it('hands over when every tool that ran hit an unavailable system', () => {
    const evs = [runStart, started('a', 'get_customer_orders'), finished('a', err('failed')), started('b', 'search_service_knowledge', 'knowledge'), finished('b', err('index_not_ready')), final('answered')]
    expect(handsOver(run(evs, 'answered'))).toBe(true)
    // An access refusal is an honest answer, not a handover.
    expect(handsOver(run([runStart, started('a', 'get_shipments', 'logistics'), finished('a', err('forbidden')), final('answered')], 'answered'))).toBe(false)
    // One working tool means the agent could answer.
    const mixed = [runStart, started('a', 'get_customer_orders'), finished('a', ok({ orders: [] })), started('b', 'check_warranty', 'warranty'), finished('b', err('failed')), final('answered')]
    expect(handsOver(run(mixed, 'answered'))).toBe(false)
  })

  it('does not report a handover when a ticket was created, or while the run is in progress', () => {
    const evs = [runStart, started('t', 'create_service_ticket', 'tickets'), finished('t', ok({ ticket_id: 'TCK-2026-0001' })), started('b', 'check_warranty', 'warranty'), finished('b', err('failed')), final('answered')]
    expect(handsOver(run(evs, 'answered'))).toBe(false)
    expect(handsOver(run([runStart, started('a', 'get_customer_orders'), finished('a', err('failed'))]))).toBe(false)
  })

  it('runView bundles steps, sources, ticket and handover; undefined run gives an empty view', () => {
    const v = runView(run([runStart, started('t', 'create_service_ticket', 'tickets'), finished('t', ok({ ticket_id: 'TCK-2026-0001' })), final('answered')], 'answered'))
    expect(v.ticketId).toBe('TCK-2026-0001')
    expect(v.handover).toBe(false)
    expect(v.steps).toHaveLength(1)
    expect(v.sources).toEqual([{ kind: 'ticket', id: 'TCK-2026-0001' }])
    expect(v.endReason).toBeNull()
    expect(runView(undefined)).toEqual({ steps: [], sources: [], ticketId: null, handover: false, endReason: null })
    const limited: TraceEvent = { type: 'run_finished', at: 9, outcome: 'error', detail: 'rate_limited', answer: '' }
    expect(runView(run([runStart, limited], 'error')).endReason).toBe('rate_limited')
  })
})
