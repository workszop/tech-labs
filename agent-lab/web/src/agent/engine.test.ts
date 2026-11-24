import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentMessage, AgentRequest, AgentResponse, RejectedToolCall, ValidatedToolCall } from '@shared/api-types'
import { getTool, type ToolName } from '@shared/tools'
import type { ToolContext, ToolResult } from '@/sim/tools'
import { runAgent } from './engine'
import { boundHistory, estimateMessagesTokens, fitToolContent, MAX_TOOL_CONTENT_CHARS } from './limits'
import type { EngineDeps, RunInput, TraceEvent } from './types'

// ---------------------------------------------------------------- fakes

const RUN_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'

function call(id: string, name: ToolName, args: Record<string, unknown> = {}): ValidatedToolCall {
  const def = getTool(name)
  return { id, name, arguments: args, system: def.system, readOnly: def.readOnly, requiresConfirmation: !def.readOnly }
}

function rejected(id: string, name: string, reason: RejectedToolCall['reason'] = 'unknown_tool', rawArguments = '{}'): RejectedToolCall {
  return { id, name, rawArguments, reason, message: `rejected: ${reason}` }
}

const LIMITS = { maxSteps: 8, maxToolCalls: 12, maxRunTokens: 40000, stepsUsed: 1, toolCallsUsed: 0, runTokens: 0 }
const QUOTA = { requestsUsed: 1, requestLimit: 100, tokensUsed: 10, tokenLimit: 100000, estimatedCostUsd: 0, codeExpiresAt: null }

function base(step: number): Omit<AgentResponse, 'kind' | 'assistantMessage' | 'toolCalls' | 'rejected'> {
  return {
    runId: RUN_ID, step, model: 'mock-rule-based-agent', forcedFinal: false, finishReason: 'stop',
    usage: { inputTokens: 100, outputTokens: 10 }, durationMs: 5, quota: QUOTA, limits: { ...LIMITS, stepsUsed: step },
  }
}

/** A tool_calls turn. `order` lists the call ids in the model's order (default: valid, then rejected). */
function toolTurn(step: number, calls: ValidatedToolCall[], rej: RejectedToolCall[] = [], extra: Partial<AgentResponse> = {}): AgentResponse {
  const all = [...calls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments })), ...rej.map((r) => ({ id: r.id, name: r.name, arguments: {} }))]
  return { ...base(step), kind: 'tool_calls', assistantMessage: { role: 'assistant', content: '', toolCalls: all }, toolCalls: calls, rejected: rej, ...extra }
}

function finalTurn(step: number, text: string, extra: Partial<AgentResponse> = {}): AgentResponse {
  return { ...base(step), kind: 'final', assistantMessage: { role: 'assistant', content: text }, toolCalls: [], rejected: [], ...extra }
}

type Script = AgentResponse | Error | ((req: AgentRequest, signal: AbortSignal) => Promise<AgentResponse>)

const OK = (name: string): ToolResult => ({ ok: true, data: { tool: name }, summary: `${name} ok` })

function setup(script: Script[], opts: { confirm?: EngineDeps['confirm']; exec?: (name: ToolName, args: Record<string, unknown>) => Promise<ToolResult> } = {}) {
  const events: TraceEvent[] = []
  const requests: AgentRequest[] = []
  const executed: { name: ToolName; args: Record<string, unknown> }[] = []
  let i = 0
  let clock = 1000
  const toolContext: ToolContext = { customerId: 'CUST-1042', lang: 'en', searchKnowledge: async () => [] }
  const deps: EngineDeps = {
    agentStep: async (req, signal) => {
      // Snapshot: the engine keeps appending to its transcript.
      requests.push(structuredClone(req))
      const s = script[i++]
      if (!s) throw new Error('script exhausted')
      if (s instanceof Error) throw s
      if (typeof s === 'function') return s(req, signal)
      return structuredClone(s)
    },
    executeTool: vi.fn(async (name: ToolName, args: Record<string, unknown>) => {
      executed.push({ name, args })
      return opts.exec ? opts.exec(name, args) : OK(name)
    }),
    toolContext,
    confirm: opts.confirm ?? (async () => true),
    emit: (e) => events.push(e),
    now: () => (clock += 10),
  }
  return { deps, events, requests, executed }
}

function input(history: AgentMessage[] = [], message = 'My Barista Pro 500 shows E04.'): RunInput {
  return { runId: RUN_ID, lang: 'en', customer: { id: 'CUST-1042', name: 'Emma Wilson' }, enabledTools: ['get_customer_orders', 'check_warranty', 'create_service_ticket'], history, message }
}

const types = (events: TraceEvent[]) => events.map((e) => e.type)

/** Every assistant tool call is answered by exactly one tool message with the same name, right after it. */
function expectValidTranscript(t: AgentMessage[]) {
  expect(t[0]?.role).toBe('user')
  let pending: Map<string, string> = new Map()
  for (const m of t) {
    if (m.role === 'tool') {
      expect(pending.get(m.toolCallId)).toBe(m.name)
      pending.delete(m.toolCallId)
      expect(() => JSON.parse(m.content)).not.toThrow()
    } else {
      expect(pending.size).toBe(0)
      if (m.role === 'assistant') pending = new Map((m.toolCalls ?? []).map((c) => [c.id, c.name]))
    }
  }
  expect(pending.size).toBe(0)
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------- tests

describe('runAgent: loop', () => {
  it('a sequential two-step run emits the events in the documented order and sends the tool result back', async () => {
    const { deps, events, requests, executed } = setup([
      toolTurn(1, [call('c1', 'get_customer_orders', { customer_id: 'CUST-1042' })]),
      finalTurn(2, 'Your machine is covered.'),
    ])
    const res = await runAgent(input(), deps, new AbortController().signal)

    expect(types(events)).toEqual([
      'run_started', 'model_started', 'model_finished', 'tool_started', 'tool_finished', 'model_started', 'model_finished', 'run_finished',
    ])
    expect(events[0]).toMatchObject({ type: 'run_started', runId: RUN_ID, customerId: 'CUST-1042', message: 'My Barista Pro 500 shows E04.' })
    expect(events[1]).toMatchObject({ type: 'model_started', step: 1 })
    expect(events[2]).toMatchObject({ type: 'model_finished', step: 1, kind: 'tool_calls', forcedFinal: false, usage: { inputTokens: 100, outputTokens: 10 } })
    expect(events[3]).toMatchObject({ type: 'tool_started', step: 1, callId: 'c1', seq: 1, name: 'get_customer_orders', system: 'orders', readOnly: true, args: { customer_id: 'CUST-1042' } })
    expect(events[4]).toMatchObject({ type: 'tool_finished', callId: 'c1', result: { ok: true } })
    expect(events[7]).toMatchObject({ type: 'run_finished', outcome: 'answered', answer: 'Your machine is covered.' })
    expect(events[7]).not.toHaveProperty('detail')
    const ats = events.map((e) => e.at)
    expect([...ats].sort((a, b) => a - b)).toEqual(ats)

    expect(executed).toEqual([{ name: 'get_customer_orders', args: { customer_id: 'CUST-1042' } }])
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({ runId: RUN_ID, lang: 'en', customer: { id: 'CUST-1042', name: 'Emma Wilson' }, messages: [{ role: 'user', content: 'My Barista Pro 500 shows E04.' }] })
    expect(requests[1]!.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool'])
    expect(requests[1]!.messages[2]).toEqual({ role: 'tool', toolCallId: 'c1', name: 'get_customer_orders', content: JSON.stringify({ tool: 'get_customer_orders' }) })

    expect(res.outcome).toBe('answered')
    expect(res.answer).toBe('Your machine is covered.')
    expect(res.transcript.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expectValidTranscript(res.transcript)
  })

  it('sends the earlier history before the new user message', async () => {
    const history: AgentMessage[] = [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello' }]
    const { deps, requests } = setup([finalTurn(1, 'Sure.')])
    const res = await runAgent(input(history, 'Next question'), deps, new AbortController().signal)
    expect(requests[0]!.messages).toEqual([...history, { role: 'user', content: 'Next question' }])
    expect(res.transcript).toHaveLength(4)
  })

  it('runs two read-only calls of one step concurrently', async () => {
    const gates = new Map<string, ReturnType<typeof deferred<ToolResult>>>()
    const { deps, events, executed } = setup(
      [toolTurn(1, [call('a', 'get_customer_orders', { customer_id: 'CUST-1042' }), call('b', 'check_warranty', { customer_id: 'CUST-1042', serial_number: 'X' })]), finalTurn(2, 'Done.')],
      {
        exec: (name) => {
          const d = deferred<ToolResult>()
          gates.set(name, d)
          return d.promise
        },
      },
    )
    const run = runAgent(input(), deps, new AbortController().signal)
    await vi.waitFor(() => expect(executed).toHaveLength(2))
    // Both started, neither finished.
    expect(types(events).filter((t) => t.startsWith('tool_'))).toEqual(['tool_started', 'tool_started'])
    gates.get('check_warranty')!.resolve(OK('check_warranty'))
    gates.get('get_customer_orders')!.resolve(OK('get_customer_orders'))
    const res = await run
    const tools = events.filter((e) => e.type === 'tool_started' || e.type === 'tool_finished')
    expect(tools.map((e) => `${e.type}:${e.callId}`)).toEqual(['tool_started:a', 'tool_started:b', 'tool_finished:b', 'tool_finished:a'])
    expect(events.filter((e) => e.type === 'tool_started').map((e) => (e as { seq: number }).seq)).toEqual([1, 2])
    // Tool messages follow the model's order, not the completion order.
    expect(res.transcript.filter((m) => m.role === 'tool').map((m) => (m as { toolCallId: string }).toolCallId)).toEqual(['a', 'b'])
  })

  it('answers rejected calls with error results and does not execute them; the run continues', async () => {
    const { deps, events, requests, executed } = setup([
      toolTurn(1, [call('ok1', 'get_customer_orders', { customer_id: 'CUST-1042' })], [
        rejected('r1', 'delete_everything', 'unknown_tool'),
        rejected('r2', '', 'unknown_tool', 'not json'),
        rejected('r3', 'check_warranty', 'invalid_arguments', '{"customer_id":"CUST-1042"'),
      ]),
      finalTurn(2, 'Answer.'),
    ])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(executed.map((e) => e.name)).toEqual(['get_customer_orders'])
    const tools = requests[1]!.messages.filter((m) => m.role === 'tool') as Extract<AgentMessage, { role: 'tool' }>[]
    expect(tools.map((m) => [m.toolCallId, m.name])).toEqual([['ok1', 'get_customer_orders'], ['r1', 'delete_everything'], ['r2', ''], ['r3', 'check_warranty']])
    expect(JSON.parse(tools[1]!.content)).toEqual({ error: { code: 'unknown_tool', message: 'rejected: unknown_tool' } })
    expect(JSON.parse(tools[3]!.content).error.code).toBe('invalid_arguments')
    const started = events.filter((e) => e.type === 'tool_started') as Extract<TraceEvent, { type: 'tool_started' }>[]
    expect(started.map((e) => [e.callId, e.system])).toEqual([['ok1', 'orders'], ['r1', null], ['r2', null], ['r3', 'warranty']])
    const finished = events.filter((e) => e.type === 'tool_finished') as Extract<TraceEvent, { type: 'tool_finished' }>[]
    expect(finished.find((e) => e.callId === 'r1')!.result).toMatchObject({ ok: false, error: { code: 'unknown_tool' } })
    expect(res.outcome).toBe('answered')
    expectValidTranscript(res.transcript)
  })
})

describe('runAgent: confirmation', () => {
  const ticket = () => call('t1', 'create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'E04', priority: 'normal' })

  it('approve: the ticket tool runs exactly once, after the decision', async () => {
    const order: string[] = []
    const { deps, events, executed } = setup([toolTurn(1, [ticket()]), finalTurn(2, 'Ticket TCK-2026-0001 created.')], {
      confirm: async (c) => {
        order.push(`confirm:${c.id}`)
        return true
      },
      exec: async (name) => {
        order.push(`exec:${name}`)
        return OK(name)
      },
    })
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(executed.map((e) => e.name)).toEqual(['create_service_ticket'])
    expect(order).toEqual(['confirm:t1', 'exec:create_service_ticket'])
    expect(types(events).slice(3, 7)).toEqual(['tool_started', 'confirmation_requested', 'confirmation_resolved', 'tool_finished'])
    expect(events[5]).toMatchObject({ type: 'confirmation_resolved', callId: 't1', approved: true })
    expect(res.outcome).toBe('answered')
  })

  it('reject: nothing is executed, the model gets rejected_by_user and the loop continues', async () => {
    const { deps, events, requests, executed } = setup([toolTurn(1, [ticket()]), finalTurn(2, 'No ticket was created.')], { confirm: async () => false })
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(executed).toEqual([])
    expect(events.find((e) => e.type === 'confirmation_resolved')).toMatchObject({ approved: false })
    expect(events.find((e) => e.type === 'tool_finished')).toMatchObject({ result: { ok: false, error: { code: 'rejected_by_user' } } })
    const tool = requests[1]!.messages[2] as Extract<AgentMessage, { role: 'tool' }>
    expect(JSON.parse(tool.content).error.code).toBe('rejected_by_user')
    expect(res.outcome).toBe('answered')
    expect(requests).toHaveLength(2)
  })

  it('read-only calls of the step run before the confirmation is asked', async () => {
    const seen: string[] = []
    const { deps } = setup([toolTurn(1, [ticket(), call('o1', 'get_customer_orders', { customer_id: 'CUST-1042' })]), finalTurn(2, 'ok')], {
      confirm: async () => {
        seen.push('confirm')
        return true
      },
      exec: async (n) => {
        seen.push(n)
        return OK(n)
      },
    })
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(seen).toEqual(['get_customer_orders', 'confirm', 'create_service_ticket'])
    expect(res.transcript.filter((m) => m.role === 'tool').map((m) => (m as { toolCallId: string }).toolCallId)).toEqual(['t1', 'o1'])
  })
})

describe('runAgent: cancellation', () => {
  it('cancel during the model call aborts the request and ends the run as cancelled', async () => {
    let requestSignal: AbortSignal | null = null
    const { deps, events, requests } = setup([
      (_req, signal) => {
        requestSignal = signal
        return new Promise<AgentResponse>(() => undefined) // never answers
      },
    ])
    const ctl = new AbortController()
    const run = runAgent(input(), deps, ctl.signal)
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    ctl.abort()
    const res = await run
    expect(requestSignal!.aborted).toBe(true)
    expect(res.outcome).toBe('cancelled')
    expect(res.reason).toBe('cancelled')
    expect(res.answer).toBe('')
    expect(events.at(-1)).toMatchObject({ type: 'run_finished', outcome: 'cancelled', detail: 'cancelled', answer: '' })
    expect(types(events)).toEqual(['run_started', 'model_started', 'run_finished'])
    expect(res.transcript).toEqual([{ role: 'user', content: 'My Barista Pro 500 shows E04.' }])
  })

  it('cancel during a confirmation writes nothing and closes the call', async () => {
    let confirmSignal: AbortSignal | null = null
    const ctl = new AbortController()
    const { deps, events, requests, executed } = setup(
      [toolTurn(1, [call('t1', 'create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'x', priority: 'low' })])],
      {
        confirm: (_c, signal) => {
          confirmSignal = signal
          return new Promise<boolean>(() => undefined) // the user never decides
        },
      },
    )
    const run = runAgent(input(), deps, ctl.signal)
    await vi.waitFor(() => expect(events.some((e) => e.type === 'confirmation_requested')).toBe(true))
    ctl.abort()
    const res = await run
    expect(confirmSignal!.aborted).toBe(true)
    expect(executed).toEqual([])
    expect(requests).toHaveLength(1)
    expect(events.some((e) => e.type === 'confirmation_resolved')).toBe(false)
    expect(events.find((e) => e.type === 'tool_finished')).toMatchObject({ callId: 't1', result: { ok: false, error: { code: 'failed' } } })
    expect(events.at(-1)).toMatchObject({ type: 'run_finished', outcome: 'cancelled' })
    expect(res.outcome).toBe('cancelled')
    expectValidTranscript(res.transcript)
  })

  it('an already aborted signal sends no request', async () => {
    const { deps, requests } = setup([finalTurn(1, 'x')])
    const ctl = new AbortController()
    ctl.abort()
    const res = await runAgent(input(), deps, ctl.signal)
    expect(requests).toHaveLength(0)
    expect(res.outcome).toBe('cancelled')
  })
})

describe('runAgent: failures and limits', () => {
  it('a tool that throws gives a failed result and the loop continues', async () => {
    const { deps, events, requests } = setup(
      [toolTurn(1, [call('c1', 'get_customer_orders', { customer_id: 'CUST-1042' })]), finalTurn(2, 'Sorry, the order system is down.')],
      {
        exec: async () => {
          throw new Error('boom')
        },
      },
    )
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(events.find((e) => e.type === 'tool_finished')).toMatchObject({ result: { ok: false, error: { code: 'failed' } } })
    expect(JSON.parse((requests[1]!.messages[2] as { content: string }).content).error.code).toBe('failed')
    expect(res.outcome).toBe('answered')
  })

  it('an identical call is answered with duplicate_call, the third one ends the run with limit', async () => {
    const a = (id: string, args: Record<string, unknown>) => call(id, 'check_warranty', args)
    const { deps, events, requests, executed } = setup([
      toolTurn(1, [a('c1', { customer_id: 'CUST-1042', serial_number: 'BP500-26-10482' })]),
      toolTurn(2, [a('c2', { serial_number: 'BP500-26-10482', customer_id: 'CUST-1042' })]), // same, other key order
      toolTurn(3, [a('c3', { customer_id: 'CUST-1042', serial_number: 'BP500-26-10482' })]),
      finalTurn(4, 'never reached'),
    ])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(executed).toHaveLength(1)
    expect(requests).toHaveLength(3)
    const dup = requests[2]!.messages.at(-1) as Extract<AgentMessage, { role: 'tool' }>
    expect(dup.toolCallId).toBe('c2')
    expect(JSON.parse(dup.content).error.code).toBe('duplicate_call')
    expect(events.filter((e) => e.type === 'tool_finished').map((e) => (e as { result: ToolResult }).result.ok)).toEqual([true, false, false])
    expect(res.outcome).toBe('limit')
    expect(res.reason).toBe('tool_loop')
    expect(res.answer).toBe('')
    expect(events.at(-1)).toMatchObject({ type: 'run_finished', outcome: 'limit', detail: 'tool_loop', answer: '' })
    expectValidTranscript(res.transcript)
  })

  it('the client step guard stops a Worker that never forces a final answer', async () => {
    const turns = [1, 2, 3, 4].map((s) => toolTurn(s, [call(`c${s}`, 'get_customer_orders', { customer_id: `CUST-100${s}` })], [], { limits: { ...LIMITS, maxSteps: 3, stepsUsed: s } }))
    const { deps, requests } = setup(turns)
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(requests).toHaveLength(3)
    expect(res.outcome).toBe('limit')
    expect(res.reason).toBe('max_steps')
    expectValidTranscript(res.transcript)
  })

  it('a forced final turn that still asks for tools ends the run with limit and sends no further request', async () => {
    const { deps, requests, events } = setup([
      toolTurn(1, [], [rejected('r1', 'get_customer_orders', 'too_many_calls')], { forcedFinal: true }),
      finalTurn(2, 'never'),
    ])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(requests).toHaveLength(1)
    expect(res.outcome).toBe('limit')
    expect(res.reason).toBe('forced_final')
    expect(events.find((e) => e.type === 'model_finished')).toMatchObject({ forcedFinal: true })
    expectValidTranscript(res.transcript)
  })

  it('a forced final answer is kept and the run is marked as limited', async () => {
    const { deps } = setup([finalTurn(1, 'I reached the limit; this may be incomplete.', { forcedFinal: true })])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(res).toMatchObject({ outcome: 'limit', reason: 'forced_final', answer: 'I reached the limit; this may be incomplete.' })
  })

  it('run_limit_exceeded and quota_exceeded from the Worker end the run with limit and their message', async () => {
    for (const code of ['run_limit_exceeded', 'quota_exceeded'] as const) {
      const err = Object.assign(new Error(`server says ${code}`), { code })
      const { deps, events } = setup([err])
      const res = await runAgent(input(), deps, new AbortController().signal)
      expect(res).toMatchObject({ outcome: 'limit', reason: code, detail: `server says ${code}`, answer: '' })
      expect(events.at(-1)).toMatchObject({ type: 'run_finished', outcome: 'limit', detail: code })
    }
  })

  it('other Worker errors end the run with error and keep a valid transcript', async () => {
    const err = Object.assign(new Error('provider down'), { code: 'upstream_unavailable' })
    const { deps } = setup([toolTurn(1, [call('c1', 'get_customer_orders', { customer_id: 'CUST-1042' })]), err])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(res).toMatchObject({ outcome: 'error', reason: 'upstream_unavailable', detail: 'provider down', answer: '' })
    expectValidTranscript(res.transcript)
  })

  it('a final turn without text is an error, not an invented answer', async () => {
    const { deps } = setup([finalTurn(1, '   ')])
    const res = await runAgent(input(), deps, new AbortController().signal)
    expect(res).toMatchObject({ outcome: 'error', reason: 'empty_answer', answer: '' })
  })

  it('a too long tool result is shortened to valid JSON within the Worker limit', async () => {
    const hits = Array.from({ length: 8 }, (_, i) => ({ chunkId: `DOC-x#${i}`, docTitle: `Doc ${i}`, text: 'x'.repeat(3000) }))
    const { deps, requests } = setup([toolTurn(1, [call('k1', 'check_warranty', { customer_id: 'CUST-1042', serial_number: 'S' })]), finalTurn(2, 'ok')], {
      exec: async () => ({ ok: true, data: hits, summary: '8 hits' }),
    })
    await runAgent(input(), deps, new AbortController().signal)
    const content = (requests[1]!.messages[2] as { content: string }).content
    expect(content.length).toBeLessThanOrEqual(MAX_TOOL_CONTENT_CHARS)
    const parsed = JSON.parse(content)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0].chunkId).toBe('DOC-x#0')
  })
})

describe('runAgent: timeouts (fake timers)', () => {
  it('a model call over 60 s ends the run with limit model_timeout', async () => {
    vi.useFakeTimers()
    const { deps, requests } = setup([() => new Promise<AgentResponse>(() => undefined)])
    const run = runAgent(input(), deps, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(59_000)
    expect(requests).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1_500)
    const res = await run
    expect(res).toMatchObject({ outcome: 'limit', reason: 'model_timeout' })
  })

  it('a tool over 20 s gets a failed result and the run continues', async () => {
    vi.useFakeTimers()
    const { deps, events } = setup([toolTurn(1, [call('c1', 'get_customer_orders', { customer_id: 'CUST-1042' })]), finalTurn(2, 'ok')], {
      exec: () => new Promise<ToolResult>(() => undefined),
    })
    const run = runAgent(input(), deps, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(20_500)
    const res = await run
    expect(events.find((e) => e.type === 'tool_finished')).toMatchObject({ result: { ok: false, error: { code: 'failed' } } })
    expect(res.outcome).toBe('answered')
  })

  it('the whole run is limited to 180 s', async () => {
    vi.useFakeTimers()
    const slow = (s: number) => () => new Promise<AgentResponse>((r) => setTimeout(() => r(toolTurn(s, [call(`c${s}`, 'get_customer_orders', { customer_id: `CUST-10${10 + s}` })])), 50_000))
    const { deps, requests } = setup([1, 2, 3, 4, 5].map(slow))
    const run = runAgent(input(), deps, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(181_000)
    const res = await run
    expect(requests).toHaveLength(4)
    expect(res).toMatchObject({ outcome: 'limit', reason: 'run_timeout' })
    expectValidTranscript(res.transcript)
  })

  it('time spent waiting for a confirmation does not count towards the run limit', async () => {
    vi.useFakeTimers()
    const { deps, executed } = setup(
      [toolTurn(1, [call('t1', 'create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'x', priority: 'low' })]), finalTurn(2, 'Created.')],
      { confirm: () => new Promise<boolean>((r) => setTimeout(() => r(true), 200_000)) },
    )
    const run = runAgent(input(), deps, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(200_500)
    const res = await run
    expect(executed.map((e) => e.name)).toEqual(['create_service_ticket'])
    expect(res.outcome).toBe('answered')
  })
})

describe('limits helpers', () => {
  const ex = (n: number, size = 10): AgentMessage[] => [
    { role: 'user', content: `q${n}` },
    { role: 'assistant', content: '', toolCalls: [{ id: `c${n}`, name: 'get_customer_orders', arguments: {} }] },
    { role: 'tool', toolCallId: `c${n}`, name: 'get_customer_orders', content: 'x'.repeat(size) },
    { role: 'assistant', content: `a${n}` },
  ]

  it('boundHistory drops the oldest complete exchanges', () => {
    const h = [...ex(1), ...ex(2), ...ex(3)]
    expect(boundHistory(h, { maxMessages: 9, maxTokens: 10_000 })).toEqual([...ex(2), ...ex(3)])
    const big = [...ex(1, 4000), ...ex(2, 10)]
    const out = boundHistory(big, { maxMessages: 60, maxTokens: 500 })
    expect(out).toEqual(ex(2, 10))
    expect(estimateMessagesTokens(out)).toBeLessThanOrEqual(500)
    expect(boundHistory(h, { maxMessages: 3, maxTokens: 10_000 })).toEqual([])
  })

  it('fitToolContent keeps short content and returns valid JSON for long objects', () => {
    expect(fitToolContent('{"a":1}')).toBe('{"a":1}')
    const long = JSON.stringify({ note: 'y'.repeat(40_000) })
    const fitted = fitToolContent(long, 1000)
    expect(fitted.length).toBeLessThanOrEqual(1000)
    expect(JSON.parse(fitted).note.endsWith('…')).toBe(true)
    const many = JSON.stringify(Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, 'z'.repeat(100)])))
    const last = fitToolContent(many, 1000)
    expect(last.length).toBeLessThanOrEqual(1000)
    expect(JSON.parse(last).truncated).toBe(true)
  })
})
