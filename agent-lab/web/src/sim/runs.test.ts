import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ValidatedToolCall } from '@shared/api-types'
import type { ChatItem, RunRecord } from '@/agent/types'
import { simDb, resetSimulation } from './db'
import { clearRuns, loadConversation, loadRuns, restoreConversationItems, restoreInterruptedRun, saveConversation, saveRun } from './runs'

const TICKET: ValidatedToolCall = {
  id: 't1', name: 'create_service_ticket', arguments: { customer_id: 'CUST-1042' }, system: 'tickets', readOnly: false, requiresConfirmation: true,
}

function run(id: string, startedAt: number, extra: Partial<RunRecord> = {}): RunRecord {
  return {
    id, scenarioId: null, customerId: 'CUST-1042', message: 'E04?', enabledTools: ['create_service_ticket'], startedAt, model: 'mock-rule-based-agent', lang: 'pl',
    events: [{ type: 'run_started', runId: id, at: startedAt, customerId: 'CUST-1042', message: 'E04?', enabledTools: ['create_service_ticket'] }],
    ...extra,
  }
}

/** A run that was waiting for the ticket confirmation when the page was reloaded. */
function waitingRun(id: string, at: number): RunRecord {
  const r = run(id, at)
  r.events.push(
    { type: 'model_started', step: 1, at: at + 1 },
    { type: 'model_finished', step: 1, at: at + 2, durationMs: 1, kind: 'tool_calls', text: '', usage: { inputTokens: 1, outputTokens: 1 }, forcedFinal: false },
    { type: 'tool_started', step: 1, callId: 't1', seq: 1, name: 'create_service_ticket', system: 'tickets', readOnly: false, args: {}, at: at + 3 },
    { type: 'confirmation_requested', callId: 't1', at: at + 4 },
  )
  return r
}

beforeEach(async () => {
  await resetSimulation()
  await clearRuns()
  await simDb.conversation.clear()
})

describe('restoring after a reload', () => {
  it('a run waiting for an undecided confirmation becomes cancelled; the call is closed as not_executed', () => {
    const restored = restoreInterruptedRun(waitingRun('r1', 100))
    expect(restored.outcome).toBe('cancelled')
    expect(restored.answer).toBe('')
    // Closing events are dated at the last recorded event, not at the reload; the call never ran: durationMs 0.
    expect(restored.events.slice(-2)).toEqual([
      { type: 'tool_finished', callId: 't1', at: 104, durationMs: 0, result: { ok: false, error: { code: 'not_executed', message: expect.stringContaining('Nothing was executed') }, summary: 'Nie uruchomiono' } },
      { type: 'run_finished', at: 104, outcome: 'cancelled', detail: 'reload', answer: '' },
    ])
    expect(restored.events.some((e) => e.type === 'confirmation_resolved')).toBe(false)
    const done = run('r2', 1, { outcome: 'answered', answer: 'ok' })
    expect(restoreInterruptedRun(done)).toBe(done)
  })

  it('an approved but unfinished ticket call is closed as result_unknown, never as "nothing was done"', () => {
    const r = waitingRun('r1', 100)
    r.events.push({ type: 'confirmation_resolved', callId: 't1', approved: true, at: 105 })
    const closed = restoreInterruptedRun(r).events.find((e) => e.type === 'tool_finished')!
    expect(closed).toMatchObject({ at: 105, durationMs: 0, result: { ok: false, error: { code: 'result_unknown' }, summary: 'Wynik nie został zapisany' } })
    expect(JSON.stringify(closed)).not.toMatch(/Nothing was executed/)
  })

  it('an in-flight read-only call is closed as result_unknown', () => {
    const r = run('r1', 100)
    r.events.push({ type: 'tool_started', step: 1, callId: 'o1', seq: 1, name: 'get_customer_orders', system: 'orders', readOnly: true, args: {}, at: 103 })
    const closed = restoreInterruptedRun(r).events.find((e) => e.type === 'tool_finished')!
    expect(closed).toMatchObject({ callId: 'o1', durationMs: 0, result: { error: { code: 'result_unknown' } } })
  })

  it('loadRuns restores interrupted runs from IndexedDB, saves them as cancelled and writes no ticket', async () => {
    await saveRun(run('old', 10, { outcome: 'answered', answer: 'done' }))
    await saveRun(waitingRun('live', 20))
    const { runs, interrupted } = await loadRuns()
    expect(runs.map((r) => [r.id, r.outcome])).toEqual([['old', 'answered'], ['live', 'cancelled']])
    expect([...interrupted]).toEqual(['live'])
    expect((await simDb.runs.get('live'))!.outcome).toBe('cancelled')
    expect(await simDb.tickets.count()).toBe(0)
  })

  it('keeps only the newest 20 runs', async () => {
    for (let i = 0; i < 23; i++) await saveRun(run(`r${i}`, i, { outcome: 'answered', answer: '' }))
    const { runs } = await loadRuns()
    expect(runs).toHaveLength(20)
    expect(runs[0]!.id).toBe('r3')
    expect(await simDb.runs.count()).toBe(20)
  })

  it('a pending confirmation card becomes cancelled and the interrupted run gets a reload notice', async () => {
    const items: ChatItem[] = [
      { kind: 'customer', id: 'm1', runId: 'live', text: 'E04?', at: 1 },
      { kind: 'confirmation', id: 'c1', runId: 'live', callId: 't1', call: TICKET, state: 'pending', at: 2 },
    ]
    await saveConversation({ conversationId: 'conv', customerId: 'CUST-1042', lang: 'pl', items, history: [] })
    const stored = (await loadConversation())!
    const out = restoreConversationItems(stored.items, new Set(['live', 'gone']), 9)
    expect(out).toEqual([
      items[0],
      { ...items[1], state: 'cancelled' },
      { kind: 'notice', id: 'notice-live', runId: 'live', outcome: 'cancelled', messageKey: 'reload', at: 9 },
    ])
  })
})

describe('repeatOf (Task 10)', () => {
  it('a run that repeats another keeps repeatOf; an older record without the field loads unchanged', async () => {
    const old = { ...run('r-old', 100), outcome: 'answered' as const, answer: 'A' }
    await saveRun(old)
    await saveRun({ ...run('r-new', 200), outcome: 'answered', answer: 'B', repeatOf: 'r-old' })
    const { runs } = await loadRuns()
    expect(runs.map((r) => r.id)).toEqual(['r-old', 'r-new'])
    expect(runs[0]).toEqual(old)
    expect(runs[0]!.repeatOf).toBeUndefined()
    expect(runs[1]!.repeatOf).toBe('r-old')
  })
})
