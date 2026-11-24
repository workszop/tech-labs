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
  it('a run in progress or waiting for confirmation becomes cancelled and its open call is closed', () => {
    const restored = restoreInterruptedRun(waitingRun('r1', 100), 500)
    expect(restored.outcome).toBe('cancelled')
    expect(restored.answer).toBe('')
    expect(restored.events.slice(-2)).toEqual([
      { type: 'tool_finished', callId: 't1', at: 500, durationMs: 397, result: { ok: false, error: { code: 'failed', message: expect.stringContaining('Nothing was executed') }, summary: expect.stringContaining('odświeżenie') } },
      { type: 'run_finished', at: 500, outcome: 'cancelled', detail: 'reload', answer: '' },
    ])
    expect(restored.events.some((e) => e.type === 'confirmation_resolved')).toBe(false)
    const done = run('r2', 1, { outcome: 'answered', answer: 'ok' })
    expect(restoreInterruptedRun(done, 5)).toBe(done)
  })

  it('loadRuns restores interrupted runs from IndexedDB, saves them as cancelled and writes no ticket', async () => {
    await saveRun(run('old', 10, { outcome: 'answered', answer: 'done' }))
    await saveRun(waitingRun('live', 20))
    const { runs, interrupted } = await loadRuns(1000)
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
