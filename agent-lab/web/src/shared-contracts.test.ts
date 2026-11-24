import { describe, expect, it } from 'vitest'
import { buildAgentSystemPrompt } from '@shared/agent-prompt'
import { estimateTokens, isLang } from '@shared/api-types'
import { SIM_TODAY } from '@shared/sim'
import { TOOLS, TOOL_NAMES, type ToolName, getTool, isToolName, validateToolArgs } from '@shared/tools'

/** A valid argument object for every tool, used as the base for negative cases. */
const VALID: Record<ToolName, Record<string, unknown>> = {
  get_customer_profile: { customer_id: 'CUST-1042' },
  get_customer_orders: { customer_id: 'CUST-1042' },
  get_product_details: { product_id: 'PRD-COFFEE-1' },
  check_warranty: { customer_id: 'CUST-1042', serial_number: 'BP500-26-10482' },
  get_shipments: { customer_id: 'CUST-1042' },
  track_shipment: { shipment_id: 'SHIP-2026-091' },
  get_crm_history: { customer_id: 'CUST-1042' },
  search_service_knowledge: { query: 'coffee machine error E04' },
  get_service_case: { case_id: 'CASE-2026-031' },
  create_service_ticket: { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'Error E04 again.', priority: 'normal' },
}

describe('tool registry', () => {
  it('has 10 unique tools and only create_service_ticket changes data', () => {
    expect(TOOLS).toHaveLength(10)
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(10)
    expect(TOOL_NAMES).toEqual(TOOLS.map((t) => t.name))
    const writing = TOOLS.filter((t) => !t.readOnly)
    expect(writing.map((t) => t.name)).toEqual(['create_service_ticket'])
  })

  it('maps tools to their systems', () => {
    const systems = Object.fromEntries(TOOLS.map((t) => [t.name, t.system]))
    expect(systems).toEqual({
      get_customer_profile: 'crm',
      get_customer_orders: 'orders',
      get_product_details: 'products',
      check_warranty: 'warranty',
      get_shipments: 'logistics',
      track_shipment: 'logistics',
      get_crm_history: 'crm',
      search_service_knowledge: 'knowledge',
      get_service_case: 'tickets',
      create_service_ticket: 'tickets',
    })
  })

  it('schemas are closed objects with English descriptions', () => {
    for (const t of TOOLS) {
      expect(t.parameters.type).toBe('object')
      expect(t.parameters.additionalProperties).toBe(false)
      expect(t.description.length).toBeGreaterThan(20)
      for (const r of t.parameters.required) expect(t.parameters.properties[r]).toBeDefined()
    }
  })

  it('isToolName and getTool', () => {
    expect(isToolName('check_warranty')).toBe(true)
    expect(isToolName('drop_database')).toBe(false)
    expect(isToolName(42)).toBe(false)
    expect(getTool('track_shipment').system).toBe('logistics')
  })
})

describe('validateToolArgs', () => {
  it('accepts a valid call for every tool', () => {
    for (const name of TOOL_NAMES) expect(validateToolArgs(name, VALID[name]), name).toEqual({ ok: true, args: VALID[name] })
  })

  it('every schema rejects an extra property', () => {
    for (const name of TOOL_NAMES) {
      const r = validateToolArgs(name, { ...VALID[name], sql: 'DROP TABLE orders' })
      expect(r.ok, name).toBe(false)
      if (!r.ok) expect(r.error).toContain('sql')
    }
  })

  it('names a missing required argument', () => {
    const r = validateToolArgs('check_warranty', { customer_id: 'CUST-1042' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('serial_number')
  })

  it('get_shipments needs a customer or an order', () => {
    expect(validateToolArgs('get_shipments', {}).ok).toBe(false)
    expect(validateToolArgs('get_shipments', { order_id: 'ORD-2026-0187' })).toEqual({ ok: true, args: { order_id: 'ORD-2026-0187' } })
  })

  it('enforces enums, lengths, patterns and types', () => {
    const ticket = VALID.create_service_ticket
    expect(validateToolArgs('create_service_ticket', { ...ticket, priority: 'asap' }).ok).toBe(false)
    expect(validateToolArgs('create_service_ticket', { ...ticket, issue_description: 'x'.repeat(600) }).ok).toBe(true)
    expect(validateToolArgs('create_service_ticket', { ...ticket, issue_description: 'x'.repeat(601) }).ok).toBe(false)
    expect(validateToolArgs('search_service_knowledge', { query: 'q'.repeat(300) }).ok).toBe(true)
    expect(validateToolArgs('search_service_knowledge', { query: 'q'.repeat(301) }).ok).toBe(false)
    expect(validateToolArgs('check_warranty', { customer_id: 'CUST-1042', serial_number: 's'.repeat(201) }).ok).toBe(false)
    expect(validateToolArgs('get_customer_orders', { customer_id: '1042' }).ok).toBe(false)
    expect(validateToolArgs('get_service_case', { case_id: 'CASE-26-31' }).ok).toBe(false)
    expect(validateToolArgs('get_product_details', { product_id: 'PRD-coffee-1' }).ok).toBe(false)
    expect(validateToolArgs('get_customer_orders', { customer_id: 1042 }).ok).toBe(false)
    expect(validateToolArgs('get_customer_orders', { customer_id: '   ' }).ok).toBe(false)
    expect(validateToolArgs('get_customer_orders', null).ok).toBe(false)
    expect(validateToolArgs('get_customer_orders', ['CUST-1042']).ok).toBe(false)
  })

  it('treats an optional argument sent as "" or null as omitted (final fix finding 6)', () => {
    expect(validateToolArgs('search_service_knowledge', { query: 'E04', error_code: '', product_model: null })).toEqual({ ok: true, args: { query: 'E04' } })
    expect(validateToolArgs('get_shipments', { customer_id: 'CUST-1042', order_id: null })).toEqual({ ok: true, args: { customer_id: 'CUST-1042' } })
    expect(validateToolArgs('get_shipments', { customer_id: '  ', order_id: 'ORD-2026-0187' })).toEqual({ ok: true, args: { order_id: 'ORD-2026-0187' } })
  })

  it('a required argument sent as "" or null is still an error, and so are all-empty alternatives', () => {
    for (const v of ['', '   ', null]) {
      const r = validateToolArgs('check_warranty', { customer_id: 'CUST-1042', serial_number: v })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('serial_number')
    }
    expect(validateToolArgs('get_shipments', { customer_id: '', order_id: null }).ok).toBe(false)
    // Other types stay errors even for optional arguments.
    expect(validateToolArgs('search_service_knowledge', { query: 'E04', error_code: 4 }).ok).toBe(false)
  })

  it('trims strings before checking and returns the trimmed arguments', () => {
    expect(validateToolArgs('track_shipment', { shipment_id: '  SHIP-2026-091 ' })).toEqual({ ok: true, args: { shipment_id: 'SHIP-2026-091' } })
  })
})

describe('buildAgentSystemPrompt', () => {
  const customer = { id: 'CUST-1042', name: 'Emma Wilson' }

  it('contains the customer and the simulation date in both languages, without em-dashes', () => {
    expect(SIM_TODAY).toBe('2026-11-24')
    for (const lang of ['pl', 'en'] as const) {
      const p = buildAgentSystemPrompt({ lang, customer, today: SIM_TODAY, enabledTools: [...TOOL_NAMES] })
      expect(p).toContain('CUST-1042')
      expect(p).toContain('Emma Wilson')
      expect(p).toContain('2026-11-24')
      expect(p).toContain('Northstar Appliances')
      expect(p).toContain('create_service_ticket')
      expect(p).not.toContain(String.fromCharCode(0x2014))
    }
    const pl = buildAgentSystemPrompt({ lang: 'pl', customer, today: SIM_TODAY, enabledTools: [...TOOL_NAMES] })
    const en = buildAgentSystemPrompt({ lang: 'en', customer, today: SIM_TODAY, enabledTools: [...TOOL_NAMES] })
    expect(pl).not.toBe(en)
    expect(pl).toContain('Jesteś')
  })

  it('says nothing about disabled tools', () => {
    for (const lang of ['pl', 'en'] as const) {
      const p = buildAgentSystemPrompt({ lang, customer, today: SIM_TODAY, enabledTools: ['get_customer_orders', 'check_warranty'] })
      expect(p).toContain('get_customer_orders')
      expect(p).toContain('check_warranty')
      for (const name of TOOL_NAMES.filter((n) => n !== 'get_customer_orders' && n !== 'check_warranty')) expect(p, `${lang} ${name}`).not.toContain(name)
    }
  })
})

describe('helpers moved from prompt.ts', () => {
  it('estimateTokens and isLang', () => {
    expect(estimateTokens('abcdefgh')).toBe(2)
    expect(isLang('pl')).toBe(true)
    expect(isLang('de')).toBe(false)
  })
})
