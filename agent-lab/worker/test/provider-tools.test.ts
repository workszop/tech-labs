import { describe, expect, it } from 'vitest'
import { buildAgentSystemPrompt } from '../../shared/agent-prompt'
import type { AgentMessage } from '../../shared/api-types'
import { SIM_TODAY } from '../../shared/sim'
import { TOOLS, TOOL_NAMES, type ToolName } from '../../shared/tools'
import { ApiError } from '../src/http'
import { mockAgentTurn } from '../src/providers/mock-agent'
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible'
import { hit, runMock } from './fake-world'

// ---------------------------------------------------------------- openai-compatible chatWithTools

function provider(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, chatTimeoutMs = 2000) {
  return new OpenAICompatibleProvider({
    baseUrl: 'https://upstream.test/v1',
    apiKey: 'sk-unit',
    embeddingModel: 'e',
    chatModel: 'gpt-4o-mini',
    embeddingDimensions: 3,
    embedTimeoutMs: 2000,
    chatTimeoutMs,
    fetch: fetchImpl,
  })
}

const transcript: AgentMessage[] = [
  { role: 'user', content: 'Where is my parcel?' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'get_shipments', arguments: { customer_id: 'CUST-1017' } }] },
  { role: 'tool', toolCallId: 'call_1', name: 'get_shipments', content: '{"shipments":[]}' },
]
const opts = { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 700 }
const twoTools = TOOLS.filter((t) => t.name === 'get_shipments' || t.name === 'track_shipment')

function capture(reply: unknown) {
  const sent: Record<string, any>[] = []
  const f = async (url: string, init?: RequestInit) => {
    expect(url).toBe('https://upstream.test/v1/chat/completions')
    sent.push(JSON.parse(init!.body as string))
    return Response.json(reply)
  }
  return { sent, f }
}

describe('openai-compatible chatWithTools', () => {
  it('sends system + mapped transcript, function tools, tool_choice auto and parallel_tool_calls', async () => {
    const { sent, f } = capture({ choices: [{ message: { content: 'Done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 40, completion_tokens: 3 } })
    const r = await provider(f).chatWithTools('SYSTEM', transcript, twoTools, { ...opts, toolChoice: 'auto' })
    expect(r).toEqual({ text: 'Done.', toolCalls: [], finishReason: 'stop', usage: { inputTokens: 40, outputTokens: 3 } })
    const body = sent[0]!
    expect(body).toMatchObject({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 700, tool_choice: 'auto', parallel_tool_calls: true })
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYSTEM' },
      { role: 'user', content: 'Where is my parcel?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_shipments', arguments: '{"customer_id":"CUST-1017"}' } }],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"shipments":[]}' },
    ])
    expect(body.tools).toEqual(twoTools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })))
  })

  it("forced final ('none'): no tools, tool_choice or parallel_tool_calls at all", async () => {
    const { sent, f } = capture({ choices: [{ message: { content: 'Final.' }, finish_reason: 'stop' }] })
    const r = await provider(f).chatWithTools('SYSTEM', transcript, twoTools, { ...opts, toolChoice: 'none' })
    expect(r.usage).toBeNull()
    for (const k of ['tools', 'tool_choice', 'parallel_tool_calls']) expect(sent[0]).not.toHaveProperty(k)
    // An empty tool list is treated the same way.
    const again = capture({ choices: [{ message: { content: 'x' } }] })
    await provider(again.f).chatWithTools('SYSTEM', transcript, [], { ...opts, toolChoice: 'auto' })
    expect(again.sent[0]).not.toHaveProperty('tools')
    expect(again.sent[0]).not.toHaveProperty('parallel_tool_calls')
  })

  it('returns tool calls with raw (possibly malformed) arguments, content null, and generated ids', async () => {
    const { f } = capture({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: 'call_a', type: 'function', function: { name: 'get_shipments', arguments: '{"customer_id":"CUST-1017"}' } },
              { type: 'function', function: { name: 'track_shipment', arguments: '{"shipment_id": SHIP' } },
              { id: 'call_a', type: 'function', function: { name: 'track_shipment', arguments: { shipment_id: 'SHIP-2026-100' } } },
              { id: 'call_d', type: 'function', function: {} },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    })
    const r = await provider(f).chatWithTools('SYSTEM', transcript, twoTools, { ...opts, toolChoice: 'auto' })
    expect(r.text).toBe('')
    expect(r.finishReason).toBe('tool_calls')
    expect(r.toolCalls).toHaveLength(4)
    expect(r.toolCalls[0]).toEqual({ id: 'call_a', name: 'get_shipments', rawArguments: '{"customer_id":"CUST-1017"}' })
    expect(r.toolCalls[1]!.rawArguments).toBe('{"shipment_id": SHIP')
    expect(r.toolCalls[1]!.id).toMatch(/^call_\w+$/)
    // Duplicate id replaced; object arguments serialised.
    expect(r.toolCalls[2]!.id).not.toBe('call_a')
    expect(r.toolCalls[2]!.rawArguments).toBe('{"shipment_id":"SHIP-2026-100"}')
    expect(r.toolCalls[3]).toEqual({ id: 'call_d', name: '', rawArguments: '' })
    expect(new Set(r.toolCalls.map((c) => c.id)).size).toBe(4)
  })

  it('malformed upstream responses -> upstream_bad_response', async () => {
    for (const reply of [{ choices: [] }, { choices: [{ message: { content: 42 } }] }, { choices: [{ message: { tool_calls: 'x' } }] }]) {
      const { f } = capture(reply)
      await expect(provider(f).chatWithTools('S', transcript, twoTools, { ...opts, toolChoice: 'auto' })).rejects.toMatchObject({ code: 'upstream_bad_response' })
    }
    const notJson = async () => new Response('<html>', { status: 200 })
    const e = await provider(notJson).chatWithTools('S', transcript, twoTools, { ...opts, toolChoice: 'auto' }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('upstream_bad_response')
  })
})

// ---------------------------------------------------------------- mock agent: the nine scenarios

const INTRO_EN = 'I am the offline demo model of Service Agent Lab'
const INTRO_PL = 'Jestem demonstracyjnym modelem offline Service Agent Lab'

describe('mock agent (rule-based, offline)', () => {
  it('1. E04 on the coffee machine: orders -> warranty + knowledge -> answer with serial, warranty and the current document', () => {
    const r = runMock('CUST-1042', 'Hi, my Barista Pro 500 shows error E04 and will not brew coffee. What should I do, and is this covered?')
    expect(r.calls).toEqual([['get_customer_orders'], ['check_warranty', 'search_service_knowledge']])
    expect(r.steps).toBe(3)
    expect(r.answer.startsWith(INTRO_EN)).toBe(true)
    expect(r.answer).toContain('BP500-26-10482')
    expect(r.answer).toContain('WAR-0031')
    expect(r.answer).toContain('Barista Pro 500 - error codes')
    expect(r.answer).toContain('did not rely on "Barista series manual (2023)"')
    // The serial number came from the orders result and the model/error code went to the search.
    const call = r.messages.flatMap((m) => (m.role === 'assistant' ? (m.toolCalls ?? []) : [])).find((c) => c.name === 'search_service_knowledge')!
    expect(call.arguments).toMatchObject({ product_model: 'Northstar Barista Pro 500', error_code: 'E04' })
  })

  it('1 (pl). the same in Polish, with a Polish answer', () => {
    const r = runMock('CUST-1042', 'Dzień dobry, mój ekspres Barista Pro 500 pokazuje błąd E04 i nie parzy kawy. Co mam zrobić i czy obejmuje to gwarancja?', 'pl')
    expect(r.calls).toEqual([['get_customer_orders'], ['check_warranty', 'search_service_knowledge']])
    expect(r.answer.startsWith(INTRO_PL)).toBe(true)
    expect(r.answer).toContain('Gwarancja WAR-0031 jest ważna do 2028-03-12')
  })

  it('2. where is my replacement part: shipments -> track the open one', () => {
    for (const [text, lang] of [
      ['You promised to send me a new brush motor for my robot vacuum and said it would arrive on 14 November. It still has not come. Where is it?', 'en'],
      ['Obiecaliście wysłać mi nowy silnik szczotki do robota sprzątającego i miał dotrzeć 14 listopada. Nadal go nie ma. Gdzie jest?', 'pl'],
    ] as const) {
      const r = runMock('CUST-1017', text, lang)
      expect(r.calls).toEqual([['get_shipments'], ['track_shipment']])
      expect(r.answer).toContain('SHIP-2026-100')
      expect(r.answer).toContain('2026-11-27')
    }
  })

  it('3. vacuum warranty: picks the vacuum by model name, warns that the warranty ends soon', () => {
    const r = runMock('CUST-1008', 'The battery of my AeroClean V10 now lasts only a few minutes. Is the vacuum still under warranty?')
    expect(r.calls[0]).toEqual(['get_customer_orders'])
    expect(r.calls[1]).toContain('check_warranty')
    expect(r.answer).toContain('AC10-24-15502')
    expect(r.answer).toContain('8 days left')
    expect(r.answer).toMatch(/ends soon/)
  })

  it('4. repeated fault: CRM and case history, warranty, then a high-priority ticket', () => {
    const r = runMock('CUST-1029', 'My Barista Compact 200 is leaking again and shows E07. This is the third time! I want this solved for good.')
    expect(r.calls).toEqual([['get_customer_orders', 'get_crm_history'], ['check_warranty', 'get_service_case'], ['create_service_ticket']])
    const ticket = r.messages.flatMap((m) => (m.role === 'assistant' ? (m.toolCalls ?? []) : [])).find((c) => c.name === 'create_service_ticket')!
    expect(ticket.arguments).toMatchObject({ customer_id: 'CUST-1029', product_id: 'PRD-COFFEE-3', priority: 'high' })
    expect(r.answer).toContain('TCK-2026-0001')
    expect(r.answer).toContain('CASE-2026-026, CASE-2026-011')
  })

  it('5. air purifier sensor error: knowledge search with model and code', () => {
    const r = runMock('CUST-1033', 'Mój PureAir 300 pokazuje S2, a wskaźnik jakości powietrza w ogóle się nie zmienia. Jak to naprawić?', 'pl')
    expect(r.calls).toEqual([['get_customer_orders'], ['check_warranty', 'search_service_knowledge']])
    expect(r.answer).toContain('PureAir 300 service bulletin SB-12')
  })

  it('6. complaint about an overdue repair: CRM -> case, admits the missed date, hands over to people', () => {
    const r = runMock('CUST-1051', 'Mój piekarnik jest w waszym serwisie od października. Obiecaliście go na 10 listopada, nikt do mnie nie oddzwonił i nadal nic nie wiem. Chcę konkretnego terminu albo nowego piekarnika.', 'pl')
    expect(r.calls).toEqual([['get_crm_history'], ['get_service_case']])
    expect(r.answer).toContain('CASE-2026-033')
    expect(r.answer).toContain('Ten termin minął')
    expect(r.answer).toContain('zespołowi obsługi klienta')
    expect(r.answer).not.toMatch(/zostało utworzone/)
  })

  it('7. two coffee machines: asks which one instead of guessing, then continues with the answer', () => {
    const r = runMock('CUST-1036', 'My coffee machine is leaking water. Can you help?')
    expect(r.calls).toEqual([['get_customer_orders']])
    expect(r.answer).toMatch(/Which one do you mean\?$/)
    expect(r.answer).toContain('Barista Compact 200 (BC200-25-14420')
    expect(r.answer).toContain('Barista Pro 300 (BP300-24-02215')
    expect(r.answer).not.toContain('WAR-')
    // The customer answers; the orders result is reused, not fetched again.
    const next = runMock('CUST-1036', 'The Barista Pro 300 in the studio.', 'en', { history: r.messages })
    expect(next.calls).toEqual([['check_warranty', 'search_service_knowledge']])
    expect(next.answer).toContain('Warranty WAR-0008 expired on 2026-03-16')
  })

  it('8. paid repair: proposes a ticket after the warranty check; confirms the returned ID or says nothing was created', () => {
    const text = 'My AirCrisp 5 air fryer switches itself off after about ten minutes and the housing gets very hot. I think the warranty is over. Can you arrange a paid repair?'
    const ok = runMock('CUST-1005', text)
    expect(ok.calls).toEqual([['get_customer_orders'], ['check_warranty', 'search_service_knowledge'], ['create_service_ticket']])
    expect(ok.answer).toContain('Service ticket TCK-2026-0001 was created')
    expect(ok.answer).toContain('expired on 2026-02-10')

    const rejected = runMock('CUST-1005', text, 'en', { approveTicket: false })
    expect(rejected.calls.at(-1)).toEqual(['create_service_ticket'])
    expect(rejected.answer).toContain('nothing was created')
    expect(rejected.answer).not.toContain('TCK-')

    const pl = runMock('CUST-1005', 'Moja frytkownica AirCrisp 5 wyłącza się po około dziesięciu minutach, a obudowa bardzo się nagrzewa. Chyba skończyła się gwarancja. Możecie zorganizować odpłatną naprawę?', 'pl', { approveTicket: false })
    expect(pl.calls.at(-1)).toEqual(['create_service_ticket'])
    expect(pl.answer).toContain('nic nie zostało utworzone')
  })

  it('8b. "please book a repair" without a ticket tool: never claims a ticket', () => {
    const enabled = TOOL_NAMES.filter((t) => t !== 'create_service_ticket')
    const r = runMock('CUST-1005', 'Please book a repair for my AirCrisp 5.', 'en', { enabled })
    expect(r.calls.flat()).not.toContain('create_service_ticket')
    expect(r.answer).toContain('create_service_ticket')
    expect(r.answer).not.toMatch(/ticket TCK|was created/)
  })

  it("9. someone else's order: calls the tool once, gets forbidden, says it cannot access it", () => {
    const r = runMock('CUST-1023', 'Can you check order ORD-2026-0187 for me? I would like to know when it was delivered and what was in it.')
    expect(r.calls).toEqual([['get_shipments']])
    expect(r.answer).toContain('I cannot access that order ORD-2026-0187')
    const pl = runMock('CUST-1023', 'Możecie sprawdzić zamówienie ORD-2026-0187? Chciałbym wiedzieć, kiedy zostało dostarczone i co w nim było.', 'pl')
    expect(pl.calls).toEqual([['get_shipments']])
    expect(pl.answer).toContain('Nie mam dostępu do tego zamówienia ORD-2026-0187')
  })

  it('never requests a tool outside its list, at most 3 per turn, and reports what it could not use', () => {
    const enabled: ToolName[] = ['search_service_knowledge', 'get_crm_history']
    const r = runMock('CUST-1042', 'Hi, my Barista Pro 500 shows error E04 and will not brew coffee. What should I do, and is this covered?', 'en', { enabled })
    for (const step of r.calls) {
      expect(step.length).toBeLessThanOrEqual(3)
      for (const name of step) expect(enabled).toContain(name)
    }
    expect(r.calls).toEqual([['search_service_knowledge']])
    expect(r.answer).toContain('get_customer_orders')
  })

  it('quotes one or two clean sentences from the top current hit, preferring a model-specific or bulletin document', () => {
    const knowledge = [
      hit('Barista series manual (2023)', '## E04\n- Descale the machine.', 'superseded', 'manual', 0.95),
      hit('Barista Pro 500 user manual', '## Error codes\nThe display shows a code from E01 to E09.', 'current', 'manual', 0.9),
      hit(
        'Barista Pro 500 - error codes',
        '## E04: water flow blocked\n**E04** means the brewing unit is blocked. Switch the machine off and rinse the *brew unit*.\n- Restart the machine.\n- Call service if it returns.',
        'current',
        'model_specific',
        0.85,
      ),
    ]
    const r = runMock('CUST-1042', 'My Barista Pro 500 shows error E04. What should I do?', 'en', { enabled: ['search_service_knowledge'], knowledge })
    expect(r.calls).toEqual([['search_service_knowledge']])
    expect(r.answer).toContain('From "Barista Pro 500 - error codes": E04 means the brewing unit is blocked. Switch the machine off and rinse the brew unit.')
    expect(r.answer).not.toContain('Restart the machine')
    expect(r.answer).not.toContain('Barista Pro 500 user manual')
    expect(r.answer).toContain('did not rely on "Barista series manual (2023)"')
    expect(r.answer).not.toMatch(/##|\*|^\s*- /m)

    const pl = runMock('CUST-1042', 'Mój Barista Pro 500 pokazuje błąd E04. Co robić?', 'pl', {
      enabled: ['search_service_knowledge'],
      knowledge: [hit('Instrukcja Barista Pro 500', '## Kody błędów\n- **E04**: zablokowany przepływ wody\n- E05: brak ciśnienia', 'current', 'manual')],
    })
    expect(pl.answer).toContain('Według dokumentu „Instrukcja Barista Pro 500”: E04: zablokowany przepływ wody. E05: brak ciśnienia.')
  })

  it('index_not_ready: does not retry the search and says the knowledge base is not ready', () => {
    const r = runMock('CUST-1033', 'My PureAir 300 shows S2 and the air quality number never changes. How can I fix it?', 'en', { indexNotReady: true })
    expect(r.calls.flat().filter((n) => n === 'search_service_knowledge')).toHaveLength(1)
    expect(r.answer).toContain('not ready')
  })

  it('error results are never retried with identical arguments (duplicate_call, tool_disabled, forbidden)', () => {
    for (const code of ['duplicate_call', 'tool_disabled', 'forbidden']) {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Where is my parcel?' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_shipments', arguments: { customer_id: 'CUST-1017' } }] },
        { role: 'tool', toolCallId: 'c1', name: 'get_shipments', content: JSON.stringify({ error: { code, message: 'x' } }) },
      ]
      const r = turn('CUST-1017', messages)
      expect(r.toolCalls).toEqual([])
      expect(r.text.startsWith(INTRO_EN)).toBe(true)
    }
    expect(turn('CUST-1017', [
      { role: 'user', content: 'Where is my parcel?' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_shipments', arguments: { customer_id: 'CUST-1017' } }] },
      { role: 'tool', toolCallId: 'c1', name: 'get_shipments', content: '{"error":{"code":"duplicate_call","message":"x"}}' },
    ]).text).toContain('repeated get_shipments call was blocked')
  })

  it('a call the Worker rejected (arguments {}) is not requested again', () => {
    const messages: AgentMessage[] = [
      { role: 'user', content: 'Where is my parcel?' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'get_shipments', arguments: {} }] },
      { role: 'tool', toolCallId: 'c1', name: 'get_shipments', content: '{"error":{"code":"invalid_arguments","message":"bad"}}' },
    ]
    const r = turn('CUST-1017', messages)
    expect(r.toolCalls).toEqual([])
    expect(r.text.startsWith(INTRO_EN)).toBe(true)
  })

  it("forced final ('none'): answers with what it has and says the answer may be incomplete", () => {
    const messages: AgentMessage[] = [{ role: 'user', content: 'Where is my parcel?' }]
    const r = turn('CUST-1017', messages, 'none')
    expect(r.toolCalls).toEqual([])
    expect(r.text).toContain('reached the limit')
  })
})

function turn(customerId: string, messages: AgentMessage[], toolChoice: 'auto' | 'none' = 'auto') {
  const system = buildAgentSystemPrompt({ lang: 'en', customer: { id: customerId, name: 'T' }, today: SIM_TODAY, enabledTools: [...TOOL_NAMES] })
  return mockAgentTurn(system, messages, toolChoice === 'none' ? [] : [...TOOLS], { model: 'm', temperature: 0.2, maxTokens: 700, lang: 'en', toolChoice })
}
