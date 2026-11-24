import { describe, expect, it } from 'vitest'
import { TOOL_NAMES, getTool, type ToolName } from '@shared/tools'
import type { RunRecord, TraceEvent } from '@/agent/types'
import { compareRuns, defaultPartner } from './compare'
import { disabledTools, presetOf, presetTools } from './presets'

const USAGE = { inputTokens: 100, outputTokens: 20 }

/** A finished run that made the given calls (one model turn per call, then a final turn). */
function run(id: string, enabled: readonly ToolName[], calls: [ToolName, Record<string, unknown>, boolean?][], extra: Partial<RunRecord> = {}): RunRecord {
  const t0 = 1000
  const events: TraceEvent[] = [{ type: 'run_started', runId: id, at: t0, customerId: 'CUST-1008', message: 'Warranty?', enabledTools: [...enabled] }]
  let at = t0
  calls.forEach(([name, args, ok = true], i) => {
    const step = i + 1
    events.push({ type: 'model_started', step, at: ++at })
    events.push({ type: 'model_finished', step, at: ++at, durationMs: 1, kind: 'tool_calls', text: '', usage: USAGE, forcedFinal: false })
    events.push({ type: 'tool_started', step, callId: `${id}-c${step}`, seq: step, name, system: getTool(name).system, readOnly: true, args, at: ++at })
    events.push({
      type: 'tool_finished', callId: `${id}-c${step}`, at: ++at, durationMs: 1,
      result: ok ? { ok: true, data: {}, summary: `${name} ok` } : { ok: false, error: { code: 'forbidden', message: 'no' }, summary: 'Access denied' },
    })
  })
  const step = calls.length + 1
  events.push({ type: 'model_started', step, at: ++at })
  events.push({ type: 'model_finished', step, at: ++at, durationMs: 1, kind: 'final', text: 'Answer', usage: USAGE, forcedFinal: false })
  events.push({ type: 'run_finished', at: t0 + 500, outcome: 'answered', answer: `Answer of ${id}` })
  return { id, scenarioId: 'warranty-question', customerId: 'CUST-1008', message: 'Warranty?', enabledTools: [...enabled], startedAt: t0, events, outcome: 'answered', answer: `Answer of ${id}`, model: 'mock', lang: 'en', ...extra }
}

const ALL = [...TOOL_NAMES]
const NO_WARRANTY = ALL.filter((n) => n !== 'check_warranty')
const ORDERS = ['get_customer_orders', { customer_id: 'CUST-1008' }] as [ToolName, Record<string, unknown>]
const WARRANTY = ['check_warranty', { customer_id: 'CUST-1008', serial_number: 'AV10-25-1' }] as [ToolName, Record<string, unknown>]

describe('compareRuns', () => {
  it('scenario 3 with and without the warranty lookup: the warranty call is only in the run that had the tool', () => {
    const a = run('a', ALL, [ORDERS, WARRANTY])
    const b = run('b', NO_WARRANTY, [ORDERS], { repeatOf: 'a' })
    const c = compareRuns(a, b)
    expect(c.a.calls.map((x) => [x.name, x.only])).toEqual([['get_customer_orders', false], ['check_warranty', true]])
    expect(c.b.calls.map((x) => [x.name, x.only])).toEqual([['get_customer_orders', false]])
    expect(c.onlyA).toBe(1)
    expect(c.onlyB).toBe(0)
    expect(c.a.disabled).toEqual([])
    expect(c.b.disabled).toEqual(['check_warranty'])
    expect(c.notes).toEqual([{ side: 'b', tool: 'check_warranty', system: 'warranty', otherCalls: 1 }])
    expect(c.a.calls[1]!.summary).toBe('check_warranty ok')
    expect(c.b.answer).toBe('Answer of b')
  })

  it('matches calls by tool name and canonical arguments (key order does not matter, other arguments do)', () => {
    const a = run('a', ALL, [['check_warranty', { customer_id: 'CUST-1008', serial_number: 'X' }]])
    const b = run('b', ALL, [['check_warranty', { serial_number: 'X', customer_id: 'CUST-1008' }], ['check_warranty', { customer_id: 'CUST-1008', serial_number: 'Y' }]])
    const c = compareRuns(a, b)
    expect(c.a.calls.map((x) => x.only)).toEqual([false])
    expect(c.b.calls.map((x) => x.only)).toEqual([false, true])
  })

  it('counts repeated identical calls: a second identical call in one run has no partner', () => {
    const c = compareRuns(run('a', ALL, [ORDERS, ORDERS]), run('b', ALL, [ORDERS]))
    expect(c.a.calls.map((x) => x.only)).toEqual([false, true])
    expect(c.onlyA).toBe(1)
  })

  it('totals come from the events: steps, tool calls, duration and tokens; statuses are kept', () => {
    const c = compareRuns(run('a', ALL, [ORDERS, [...WARRANTY, false] as [ToolName, Record<string, unknown>, boolean]]), run('b', ALL, []))
    expect(c.a.totals).toEqual({ steps: 3, toolCalls: 2, durationMs: 500, tokens: 360 })
    expect(c.b.totals).toEqual({ steps: 1, toolCalls: 0, durationMs: 500, tokens: 120 })
    expect(c.a.calls.map((x) => x.status)).toEqual(['ok', 'error'])
  })

  it('notes a tool that was off in one run even when the other run did not call it', () => {
    const c = compareRuns(run('a', NO_WARRANTY, [ORDERS]), run('b', ALL, [ORDERS]))
    expect(c.notes).toEqual([{ side: 'a', tool: 'check_warranty', system: 'warranty', otherCalls: 0 }])
  })
})

describe('defaultPartner', () => {
  it('is the repeated run, else the run before, else any other run', () => {
    const a = run('a', ALL, [])
    const x = run('x', ALL, [])
    const b = run('b', ALL, [], { repeatOf: 'a' })
    expect(defaultPartner([a, x, b], b)).toBe(a)
    expect(defaultPartner([a, x], x)).toBe(a)
    expect(defaultPartner([a, x], a)).toBe(x)
    expect(defaultPartner([a], a)).toBeNull()
  })
})

describe('tool presets', () => {
  it('each preset switches off what its name says', () => {
    expect(presetTools('all')).toEqual(ALL)
    expect(disabledTools(presetTools('noCrm'))).toEqual(['get_customer_profile', 'get_crm_history'])
    expect(disabledTools(presetTools('noLogistics'))).toEqual(['get_shipments', 'track_shipment'])
    expect(disabledTools(presetTools('noWarranty'))).toEqual(['check_warranty'])
    expect(disabledTools(presetTools('noKnowledge'))).toEqual(['search_service_knowledge'])
    expect(disabledTools(presetTools('readOnly'))).toEqual(['create_service_ticket'])
  })

  it('recognises a preset from the switches, and a custom choice as none', () => {
    expect(presetOf(ALL)).toBe('all')
    expect(presetOf(NO_WARRANTY)).toBe('noWarranty')
    expect(presetOf([...NO_WARRANTY].reverse())).toBe('noWarranty')
    expect(presetOf(ALL.filter((n) => n !== 'track_shipment'))).toBeNull()
  })
})
