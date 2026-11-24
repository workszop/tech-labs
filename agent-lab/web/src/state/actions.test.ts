import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentRequest, AgentResponse, SessionInfo } from '@shared/api-types'
import { simDb } from '@/sim/db'

const agentStep = vi.fn<(req: AgentRequest, signal?: AbortSignal) => Promise<AgentResponse>>()

vi.mock('@/api/client', () => ({
  api: { agentStep: (req: AgentRequest, signal?: AbortSignal) => agentStep(req, signal), embed: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message)
    }
  },
  onAuthLost: () => () => undefined,
}))

const { initApp, sendMessage, resolveConfirmation, cancelRun, persistenceIdle, resetEverything } = await import('./actions')
const { getState, setState } = await import('./store')

const QUOTA = { requestsUsed: 1, requestLimit: 100, tokensUsed: 1, tokenLimit: 1000, estimatedCostUsd: 0, codeExpiresAt: null }
const LIMITS = { maxSteps: 8, maxToolCalls: 12, maxRunTokens: 40000, stepsUsed: 1, toolCallsUsed: 1, runTokens: 1 }
const TICKET_ARGS = { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'E04 again', priority: 'normal' }

function ticketTurn(runId: string): AgentResponse {
  return {
    runId, step: 1, model: 'mock-rule-based-agent', kind: 'tool_calls',
    assistantMessage: { role: 'assistant', content: '', toolCalls: [{ id: 'call_t', name: 'create_service_ticket', arguments: TICKET_ARGS }] },
    toolCalls: [{ id: 'call_t', name: 'create_service_ticket', arguments: TICKET_ARGS, system: 'tickets', readOnly: false, requiresConfirmation: true }],
    rejected: [], forcedFinal: false, finishReason: 'tool_calls', usage: { inputTokens: 1, outputTokens: 1 }, durationMs: 1, quota: QUOTA, limits: LIMITS,
  }
}
function finalTurn(runId: string, text: string): AgentResponse {
  return {
    runId, step: 2, model: 'mock-rule-based-agent', kind: 'final', assistantMessage: { role: 'assistant', content: text }, toolCalls: [], rejected: [],
    forcedFinal: false, finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 }, durationMs: 1, quota: QUOTA, limits: { ...LIMITS, stepsUsed: 2 },
  }
}

const SESSION = {
  sessionRef: 'abc', label: null, expiresAt: '2026-12-01T00:00:00Z', usage: QUOTA,
  capabilities: { provider: 'mock', embeddingModel: 'mock-embed', chatModel: 'mock-rule-based-agent', agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 40000, maxMessageChars: 1000 } },
} as unknown as SessionInfo

/** Scripts the Worker: a ticket request, then a final answer that reads the tool result. */
function scriptTicketRun() {
  agentStep.mockImplementation(async (req) => {
    const last = req.messages.at(-1)!
    if (last.role === 'user') return ticketTurn(req.runId)
    return finalTurn(req.runId, last.role === 'tool' && last.content.includes('rejected_by_user') ? 'No ticket was created.' : 'Ticket created.')
  })
}

async function waitForConfirmation() {
  await vi.waitFor(() => expect(getState().pendingConfirmation).not.toBeNull())
}

beforeAll(async () => {
  await initApp()
})

beforeEach(async () => {
  await resetEverything()
  await persistenceIdle()
  agentStep.mockReset()
  setState({ auth: { status: 'active', session: SESSION, notice: null }, settings: { lang: 'en' } })
})

describe('sendMessage with a ticket confirmation (Review Focus 3)', () => {
  it('approve writes exactly one ticket and shows the reply', async () => {
    scriptTicketRun()
    const done = sendMessage('Please open a repair ticket.')
    await waitForConfirmation()
    expect(await simDb.tickets.count()).toBe(0)
    resolveConfirmation(true)
    await done
    expect(await simDb.tickets.count()).toBe(1)
    const s = getState()
    expect(s.conversation.map((i) => i.kind)).toEqual(['customer', 'confirmation', 'agent'])
    expect(s.conversation[1]).toMatchObject({ kind: 'confirmation', state: 'approved', callId: 'call_t' })
    expect(s.currentRun).toBeNull()
    expect(s.runs.at(-1)!.outcome).toBe('answered')
    expect(s.history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
  })

  it('reject writes nothing and the agent answers honestly', async () => {
    scriptTicketRun()
    const done = sendMessage('Please open a repair ticket.')
    await waitForConfirmation()
    resolveConfirmation(false)
    await done
    expect(await simDb.tickets.count()).toBe(0)
    const s = getState()
    expect(s.conversation[1]).toMatchObject({ kind: 'confirmation', state: 'rejected' })
    expect(s.conversation[2]).toMatchObject({ kind: 'agent', text: 'No ticket was created.' })
  })

  it('cancel while the confirmation is pending writes nothing and leaves a clean state with a notice', async () => {
    scriptTicketRun()
    const done = sendMessage('Please open a repair ticket.')
    await waitForConfirmation()
    cancelRun()
    await done
    await persistenceIdle()
    expect(await simDb.tickets.count()).toBe(0)
    const s = getState()
    expect(s.pendingConfirmation).toBeNull()
    expect(s.currentRun).toBeNull()
    expect(s.conversation.map((i) => i.kind)).toEqual(['customer', 'confirmation', 'notice'])
    expect(s.conversation[1]).toMatchObject({ state: 'cancelled' })
    expect(s.conversation[2]).toMatchObject({ kind: 'notice', outcome: 'cancelled', messageKey: 'cancelled' })
    expect(s.conversation.some((i) => i.kind === 'agent')).toBe(false)
    const run = (await simDb.runs.get(s.runs.at(-1)!.id))!
    expect(run.outcome).toBe('cancelled')
    expect(run.events.at(-1)).toMatchObject({ type: 'run_finished', outcome: 'cancelled' })
    // Later the decision arrives too late: still nothing is written.
    resolveConfirmation(true)
    expect(await simDb.tickets.count()).toBe(0)
  })

  it('a Worker limit error becomes a localized notice with the server message, never an answer', async () => {
    agentStep.mockRejectedValue(Object.assign(new Error('Run limit reached.'), { code: 'run_limit_exceeded' }))
    await sendMessage('Hello')
    const s = getState()
    expect(s.conversation.at(-1)).toMatchObject({ kind: 'notice', outcome: 'limit', messageKey: 'run_limit_exceeded', detail: 'Run limit reached.' })
    expect(s.conversation.some((i) => i.kind === 'agent')).toBe(false)
  })
})
