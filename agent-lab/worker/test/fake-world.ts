/**
 * A small stand-in for the browser's simulated company systems: tool results in
 * the shapes `toolResultForModel` (agent-lab/web/src/sim/tools.ts) produces, for
 * the customers of the predefined scenarios. Enough to drive the mock agent.
 */
import { buildAgentSystemPrompt } from '../../shared/agent-prompt'
import type { AgentMessage, Lang } from '../../shared/api-types'
import { SIM_TODAY } from '../../shared/sim'
import { TOOLS, TOOL_NAMES, type ToolName } from '../../shared/tools'
import { mockAgentTurn } from '../src/providers/mock-agent'

type Json = Record<string, unknown>
const err = (code: string, message = `${code} (test)`) => ({ error: { code, message } })

function item(product_id: string, model: string, serial_number: string | null, warranty_id: string | null) {
  return { product_id, model, quantity: 1, unit_price_eur: 100, serial_number, warranty_id }
}
function order(order_id: string, date: string, items: Json[]) {
  return { order_id, date, channel: 'online', status: 'delivered', total_eur: 100, items }
}
function warranty(warranty_id: string, serial: string, product_id: string, model: string, status: string, end: string, days: number) {
  return { warranty_id, serial_number: serial, product_id, model, order_id: null, start_date: '2025-01-01', end_date: end, months: 24, status, days_remaining: days, exclusion: null, transferred_on: null, checked_on: SIM_TODAY }
}
function hit(docTitle: string, text: string, status: 'current' | 'superseded') {
  return { chunkId: `${docTitle}#0`, docId: 'DOC-x', docTitle, section: 'Errors', text, score: 0.8, authority: 'model_specific', status, appliesTo: [], effectiveDate: '2026-01-01' }
}

interface Customer {
  orders?: Json[]
  warranties?: Record<string, Json>
  knowledge?: Json[]
  shipments?: Json[]
  crm?: Json[]
  cases?: Record<string, Json>
}

const SHIP_100 = {
  shipment_id: 'SHIP-2026-100', type: 'replacement_part', order_id: 'ORD-2025-0608', case_id: 'CASE-2026-034', carrier: 'NorthLink Express',
  tracking_number: 'NLX123', status: 'delayed', contents: 'Brush motor for RoboClean R5', shipped_date: '2026-11-11',
  estimated_delivery: '2026-11-27', delivered_date: null, last_event: { at: '2026-11-20', location: 'Leipzig hub', description: 'Held at hub' },
}

export const WORLD: Record<string, Customer> = {
  'CUST-1042': {
    orders: [
      order('ORD-2026-0523', '2026-07-20', [item('PRD-COFFEE-6', 'Northstar AquaPure Water Filter Cartridge', null, null), item('PRD-COFFEE-7', 'Northstar Descaling Kit', null, null)]),
      order('ORD-2026-0187', '2026-03-12', [item('PRD-COFFEE-1', 'Northstar Barista Pro 500', 'BP500-26-10482', 'WAR-0031')]),
    ],
    warranties: { 'BP500-26-10482': warranty('WAR-0031', 'BP500-26-10482', 'PRD-COFFEE-1', 'Northstar Barista Pro 500', 'active', '2028-03-12', 474) },
    knowledge: [
      hit('Barista Pro 500 - error codes', 'E04 means the brewing unit is blocked. Switch the machine off, remove and rinse the brewing unit, then restart.', 'current'),
      hit('Barista series manual (2023)', 'E04: descale the machine.', 'superseded'),
    ],
  },
  'CUST-1017': {
    shipments: [
      SHIP_100,
      { ...SHIP_100, shipment_id: 'SHIP-2025-071', type: 'order_delivery', status: 'delivered', contents: 'RoboClean R5', delivered_date: '2025-08-25', estimated_delivery: '2025-08-25' },
    ],
  },
  'CUST-1008': {
    orders: [
      order('ORD-2025-0356', '2025-05-17', [item('PRD-AIR-4', 'Northstar BreezePure Mini', 'BPM-25-02291', 'WAR-0019')]),
      order('ORD-2024-0876', '2024-12-02', [item('PRD-VAC-2', 'Northstar AeroClean V10', 'AC10-24-15502', 'WAR-0014')]),
    ],
    warranties: { 'AC10-24-15502': warranty('WAR-0014', 'AC10-24-15502', 'PRD-VAC-2', 'Northstar AeroClean V10', 'active', '2026-12-02', 8) },
    knowledge: [hit('AeroClean battery care', 'A battery that lasts only minutes should be checked by service.', 'current')],
  },
  'CUST-1029': {
    orders: [order('ORD-2025-0863', '2025-11-28', [item('PRD-COFFEE-3', 'Northstar Barista Compact 200', 'BC200-25-17760', 'WAR-0027')])],
    warranties: { 'BC200-25-17760': warranty('WAR-0027', 'BC200-25-17760', 'PRD-COFFEE-3', 'Northstar Barista Compact 200', 'active', '2027-11-28', 369) },
    crm: [
      { interaction_id: 'INT-0040', date: '2026-09-08', channel: 'phone', type: 'complaint', subject: 'Leak again', summary: '', outcome: '', case_id: 'CASE-2026-026', order_id: null, handled_by: 'Ravi Patel' },
      { interaction_id: 'INT-0038', date: '2026-08-24', channel: 'chat', type: 'service_request', subject: 'E07', summary: '', outcome: '', case_id: 'CASE-2026-026', order_id: null, handled_by: 'Lena Sauer' },
      { interaction_id: 'INT-0035', date: '2026-04-08', channel: 'phone', type: 'service_request', subject: 'E07', summary: '', outcome: '', case_id: 'CASE-2026-011', order_id: null, handled_by: 'Chris Dunn' },
    ],
    cases: {
      'CASE-2026-026': { case_id: 'CASE-2026-026', product_id: 'PRD-COFFEE-3', model: 'Northstar Barista Compact 200', status: 'resolved', promised_date: null, promised_date_passed: false },
    },
  },
  'CUST-1033': {
    orders: [
      order('ORD-2026-0471', '2026-06-30', [item('PRD-AIR-5', 'Northstar HEPA H13 Filter (PureAir 300/500)', null, null)]),
      order('ORD-2025-0429', '2025-06-14', [item('PRD-AIR-2', 'Northstar PureAir 300', 'PA300-25-18834', 'WAR-0020')]),
    ],
    warranties: { 'PA300-25-18834': warranty('WAR-0020', 'PA300-25-18834', 'PRD-AIR-2', 'Northstar PureAir 300', 'active', '2027-06-14', 202) },
    knowledge: [hit('PureAir 300 service bulletin SB-12', 'S2 is a sensor error: clean the particle sensor window with a dry swab.', 'current')],
  },
  'CUST-1051': {
    crm: [
      { interaction_id: 'INT-0070', date: '2026-11-19', channel: 'email', type: 'complaint', subject: 'Oven overdue', summary: '', outcome: '', case_id: 'CASE-2026-033', order_id: null, handled_by: 'Maja Lis' },
    ],
    cases: {
      'CASE-2026-033': { case_id: 'CASE-2026-033', product_id: 'PRD-KITCHEN-3', model: 'Northstar SteamChef Oven 30', status: 'in_repair', promised_date: '2026-11-10', promised_date_passed: true },
    },
  },
  'CUST-1036': {
    orders: [
      order('ORD-2026-0231', '2026-03-30', [item('PRD-VAC-1', 'Northstar AeroClean V8', 'AC8-26-08127', 'WAR-0032')]),
      order('ORD-2025-0751', '2025-10-16', [item('PRD-COFFEE-3', 'Northstar Barista Compact 200', 'BC200-25-14420', 'WAR-0026')]),
      order('ORD-2024-0198', '2024-03-16', [item('PRD-COFFEE-2', 'Northstar Barista Pro 300', 'BP300-24-02215', 'WAR-0008')]),
    ],
    warranties: {
      'BC200-25-14420': warranty('WAR-0026', 'BC200-25-14420', 'PRD-COFFEE-3', 'Northstar Barista Compact 200', 'active', '2027-10-16', 326),
      'BP300-24-02215': warranty('WAR-0008', 'BP300-24-02215', 'PRD-COFFEE-2', 'Northstar Barista Pro 300', 'expired', '2026-03-16', 0),
    },
    knowledge: [hit('Barista Compact 200 - leaks', 'Check that the water tank sits firmly and the drip tray is empty.', 'current')],
  },
  'CUST-1005': {
    orders: [
      order('ORD-2025-0559', '2025-08-03', [item('PRD-VAC-1', 'Northstar AeroClean V8', 'AC8-25-06652', 'WAR-0023')]),
      order('ORD-2024-0107', '2024-02-10', [item('PRD-KITCHEN-2', 'Northstar AirCrisp 5', 'AF5-24-20931', 'WAR-0006')]),
    ],
    warranties: { 'AF5-24-20931': warranty('WAR-0006', 'AF5-24-20931', 'PRD-KITCHEN-2', 'Northstar AirCrisp 5', 'expired', '2026-02-10', 0) },
    knowledge: [hit('AirCrisp 5 manual', 'If the fryer switches off and the housing gets hot, stop using it and contact service.', 'current')],
  },
  'CUST-1023': {},
}

export interface ExecOptions {
  /** Answer for create_service_ticket (default: approve). */
  approveTicket?: boolean
  /** Make search_service_knowledge report index_not_ready. */
  indexNotReady?: boolean
}

/** Executes one tool for `customerId` and returns the JSON text the browser would send back. */
export function execute(customerId: string, name: string, args: Json, opts: ExecOptions = {}): string {
  const c = WORLD[customerId] ?? {}
  const own = (id: unknown) => id === customerId
  const out = ((): unknown => {
    switch (name as ToolName) {
      case 'get_customer_orders':
        return own(args.customer_id) ? { customer_id: customerId, orders: c.orders ?? [] } : err('forbidden')
      case 'check_warranty': {
        if (!own(args.customer_id)) return err('forbidden')
        return c.warranties?.[String(args.serial_number)] ?? err('not_found')
      }
      case 'search_service_knowledge':
        return opts.indexNotReady ? err('index_not_ready', 'The knowledge base is not indexed yet.') : (c.knowledge ?? [])
      case 'get_shipments': {
        if (args.customer_id !== undefined && !own(args.customer_id)) return err('forbidden')
        if (args.order_id !== undefined) {
          const mine = (c.orders ?? []).some((o) => o.order_id === args.order_id)
          return mine ? { customer_id: customerId, order_id: args.order_id, shipments: [] } : err('forbidden', 'Access denied: the requested order is not linked to the authenticated customer.')
        }
        return { customer_id: customerId, shipments: c.shipments ?? [] }
      }
      case 'track_shipment': {
        const s = (c.shipments ?? []).find((x) => x.shipment_id === args.shipment_id)
        return s ? { ...s, events: [{ at: '2026-11-20', location: 'Leipzig hub', code: 'HELD', description: 'Held at hub' }], checked_on: SIM_TODAY } : err('forbidden')
      }
      case 'get_crm_history':
        return own(args.customer_id) ? { customer_id: customerId, interactions: c.crm ?? [] } : err('forbidden')
      case 'get_service_case':
        return c.cases?.[String(args.case_id)] ?? err('forbidden')
      case 'create_service_ticket':
        if (opts.approveTicket === false) return err('rejected_by_user', 'The customer rejected the ticket.')
        return { ticket_id: 'TCK-2026-0001', status: 'open', customer_id: customerId, product_id: args.product_id, model: 'x', priority: args.priority, issue_description: args.issue_description, created_date: SIM_TODAY }
      case 'get_customer_profile':
        return own(args.customer_id) ? { customer_id: customerId, name: 'Test' } : err('forbidden')
      case 'get_product_details':
        return { product_id: args.product_id, model: 'x' }
      default:
        return err('unknown_tool')
    }
  })()
  return JSON.stringify(out)
}

export interface MockRun {
  answer: string
  steps: number
  /** Tool names requested per step. */
  calls: string[][]
  messages: AgentMessage[]
}

/** Drives the mock agent the way the browser drives /api/agent (up to 8 steps, the last forced final). */
export function runMock(
  customerId: string,
  text: string,
  lang: Lang = 'en',
  opts: ExecOptions & { enabled?: ToolName[]; history?: AgentMessage[] } = {},
): MockRun {
  const enabled = opts.enabled ?? [...TOOL_NAMES]
  const system = buildAgentSystemPrompt({ lang, customer: { id: customerId, name: 'Test Customer' }, today: SIM_TODAY, enabledTools: enabled })
  const tools = TOOLS.filter((t) => enabled.includes(t.name))
  const messages: AgentMessage[] = [...(opts.history ?? []), { role: 'user', content: text }]
  const calls: string[][] = []
  for (let step = 1; step <= 8; step++) {
    const forced = step === 8
    const r = mockAgentTurn(system, messages, forced ? [] : tools, { model: 'm', temperature: 0.2, maxTokens: 700, lang, toolChoice: forced ? 'none' : 'auto' })
    const tc = r.toolCalls.map((c) => ({ id: c.id, name: c.name, arguments: JSON.parse(c.rawArguments) as Json }))
    messages.push(tc.length ? { role: 'assistant', content: r.text, toolCalls: tc } : { role: 'assistant', content: r.text })
    if (!tc.length) return { answer: r.text, steps: step, calls, messages }
    calls.push(tc.map((c) => c.name))
    for (const c of tc) messages.push({ role: 'tool', toolCallId: c.id, name: c.name, content: execute(customerId, c.name, c.arguments, opts) })
  }
  throw new Error('mock agent did not finish within 8 steps')
}
