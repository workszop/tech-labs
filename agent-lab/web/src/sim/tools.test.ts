import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeHit } from '@/data/kb/types'
import { CUSTOMERS, ORDERS, SHIPMENTS } from '@/data/company'
import { resetSimulation, seedIfEmpty, simDb } from './db'
import { executeTool, toolResultForModel, type ToolContext, type ToolResult } from './tools'

const HIT: KnowledgeHit = {
  chunkId: 'DOC-e04#0', docId: 'DOC-e04', docTitle: 'Barista Pro 500: error E04', section: 'E04', text: 'Rinse the brew unit.', score: 0.82,
  authority: 'model_specific', status: 'current', appliesTo: ['PRD-COFFEE-1'], effectiveDate: '2026-01-15',
}

function ctx(customerId = 'CUST-1042', lang: 'pl' | 'en' = 'en', search = vi.fn(async () => [HIT])): ToolContext {
  return { customerId, lang, searchKnowledge: search }
}

function ok(r: ToolResult): Record<string, unknown> {
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`)
  return r.data as Record<string, unknown>
}

beforeEach(async () => {
  await resetSimulation()
})

describe('database', () => {
  it('seedIfEmpty fills an empty database once and keeps existing rows', async () => {
    await simDb.customers.clear()
    await seedIfEmpty()
    expect(await simDb.customers.count()).toBe(CUSTOMERS.length)
    await simDb.tickets.add({ id: 'TCK-2026-0001', customerId: 'CUST-1042', productId: 'PRD-COFFEE-1', issueDescription: 'x', priority: 'low', status: 'open', createdDate: '2026-11-24', createdBy: 'agent' })
    await seedIfEmpty()
    expect(await simDb.tickets.count()).toBe(1)
  })

  it('tools read from the database, not from the seed modules', async () => {
    await simDb.orders.update('ORD-2026-0187', { status: 'returned' })
    const data = ok(await executeTool('get_customer_orders', { customer_id: 'CUST-1042' }, ctx()))
    expect((data.orders as { order_id: string; status: string }[]).find((o) => o.order_id === 'ORD-2026-0187')?.status).toBe('returned')
    expect(ORDERS.find((o) => o.id === 'ORD-2026-0187')?.status).toBe('delivered')
  })
})

describe('happy path for every tool on the anchor customer', () => {
  it('get_customer_profile', async () => {
    const r = await executeTool('get_customer_profile', { customer_id: 'CUST-1042' }, ctx())
    expect(ok(r)).toMatchObject({ customer_id: 'CUST-1042', name: 'Emma Wilson', email: 'emma.wilson@example.com' })
    expect(r.summary).toContain('Emma Wilson')
  })

  it('get_customer_orders', async () => {
    const r = await executeTool('get_customer_orders', { customer_id: 'CUST-1042' }, ctx())
    const orders = ok(r).orders as { order_id: string; items: { serial_number: string | null; model: string }[] }[]
    expect(orders.map((o) => o.order_id)).toEqual(['ORD-2026-0523', 'ORD-2026-0187'])
    expect(orders[1].items[0]).toMatchObject({ serial_number: 'BP500-26-10482', model: 'Northstar Barista Pro 500', warranty_id: 'WAR-0031' })
    expect(r.summary).toBe('2 orders, last one ORD-2026-0523')
  })

  it('get_product_details', async () => {
    const r = await executeTool('get_product_details', { product_id: 'PRD-COFFEE-1' }, ctx())
    expect(ok(r)).toMatchObject({ model: 'Northstar Barista Pro 500', warranty_months: 24, in_production: true })
  })

  it('check_warranty: active until 2028-03-12', async () => {
    const r = await executeTool('check_warranty', { customer_id: 'CUST-1042', serial_number: 'BP500-26-10482' }, ctx())
    expect(ok(r)).toMatchObject({ warranty_id: 'WAR-0031', status: 'active', start_date: '2026-03-12', end_date: '2028-03-12', days_remaining: 474, exclusion: null })
    expect(r.summary).toBe('Warranty active until 2028-03-12 (474 days left)')
  })

  it('get_shipments by customer and by order', async () => {
    const all = ok(await executeTool('get_shipments', { customer_id: 'CUST-1042' }, ctx())).shipments as { shipment_id: string }[]
    expect(all.map((s) => s.shipment_id)).toEqual(['SHIP-2026-091', 'SHIP-2026-064', 'SHIP-2026-023'])
    const forOrder = ok(await executeTool('get_shipments', { order_id: 'ORD-2026-0187' }, ctx())).shipments as { shipment_id: string }[]
    expect(forOrder.map((s) => s.shipment_id)).toEqual(['SHIP-2026-091', 'SHIP-2026-023'])
  })

  it('track_shipment', async () => {
    const r = await executeTool('track_shipment', { shipment_id: 'SHIP-2026-091' }, ctx())
    const d = ok(r)
    expect(d).toMatchObject({ status: 'delivered', delivered_date: '2026-10-15', case_id: 'CASE-2026-031', type: 'replacement_part' })
    expect((d.events as unknown[]).length).toBeGreaterThan(2)
    expect(r.summary).toBe('SHIP-2026-091: delivered on 2026-10-15')
  })

  it('get_crm_history', async () => {
    const r = await executeTool('get_crm_history', { customer_id: 'CUST-1042' }, ctx())
    const rows = ok(r).interactions as { case_id: string | null; date: string }[]
    expect(rows).toHaveLength(3)
    expect(rows[0].date).toBe('2026-10-16')
    expect(rows.some((i) => i.case_id === 'CASE-2026-031')).toBe(true)
  })

  it('search_service_knowledge delegates to ctx.searchKnowledge', async () => {
    const search = vi.fn(async () => [HIT])
    const r = await executeTool('search_service_knowledge', { query: 'E04', product_model: 'Northstar Barista Pro 500', error_code: 'E04' }, ctx('CUST-1042', 'en', search))
    expect(search).toHaveBeenCalledWith({ query: 'E04', productModel: 'Northstar Barista Pro 500', errorCode: 'E04' })
    expect(ok(r)).toEqual([HIT])
    expect(r.summary).toBe('1 passage, best: Barista Pro 500: error E04')
  })

  it('search_service_knowledge reports an index error as an error result', async () => {
    const search = vi.fn(async () => {
      throw Object.assign(new Error('The knowledge base is not indexed yet.'), { code: 'index_not_ready' })
    })
    const r = await executeTool('search_service_knowledge', { query: 'E04' }, ctx('CUST-1042', 'en', search))
    expect(r).toMatchObject({ ok: false, error: { code: 'index_not_ready', message: 'The knowledge base is not indexed yet.' } })
  })

  it('get_service_case', async () => {
    const r = await executeTool('get_service_case', { case_id: 'CASE-2026-031' }, ctx())
    expect(ok(r)).toMatchObject({ status: 'resolved', serial_number: 'BP500-26-10482', shipment_ids: ['SHIP-2026-091'], promised_date_passed: false })
  })

  it('create_service_ticket writes TCK-2026-0001, then TCK-2026-0002', async () => {
    const args = { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'Error E04, brewing stops.', priority: 'normal' }
    const r = await executeTool('create_service_ticket', args, ctx())
    expect(ok(r)).toMatchObject({ ticket_id: 'TCK-2026-0001', status: 'open', created_date: '2026-11-24' })
    expect(await simDb.tickets.get('TCK-2026-0001')).toMatchObject({ customerId: 'CUST-1042', productId: 'PRD-COFFEE-1', priority: 'normal', status: 'open' })
    expect(ok(await executeTool('create_service_ticket', args, ctx())).ticket_id).toBe('TCK-2026-0002')
    expect(r.summary).toBe('Ticket TCK-2026-0001 created (normal priority)')
  })

  it('returns text fields and summaries in ctx.lang', async () => {
    const r = await executeTool('get_service_case', { case_id: 'CASE-2026-031' }, ctx('CUST-1042', 'pl'))
    expect(ok(r).fault).toBe('Dysza parowa nie wytwarza pary; kawa parzy się normalnie.')
    expect(r.summary).toBe('CASE-2026-031: zamknięta')
    const o = await executeTool('get_customer_orders', { customer_id: 'CUST-1042' }, ctx('CUST-1042', 'pl'))
    expect(o.summary).toBe('2 zamówienia, ostatnie ORD-2026-0523')
  })
})

describe('Review Focus 1: records of another customer are refused by the tool', () => {
  // Daniel Kim (CUST-1023) is the authenticated customer; everything below belongs to Emma Wilson (CUST-1042).
  const daniel = () => ctx('CUST-1023')
  const emmaValues = ['Emma', 'Wilson', 'emma.wilson', 'BP500-26-10482', 'WAR-0031', '2026-03-12', '2028-03-12', 'Barista Pro 500', 'SHIP-2026-023', 'SHIP-2026-091', 'Cork', 'steam']

  const cases: [string, Parameters<typeof executeTool>[0], Record<string, unknown>][] = [
    ['order (get_shipments by order)', 'get_shipments', { order_id: 'ORD-2026-0187' }],
    ['shipment', 'track_shipment', { shipment_id: 'SHIP-2026-091' }],
    ['service case', 'get_service_case', { case_id: 'CASE-2026-031' }],
    ['serial number', 'check_warranty', { customer_id: 'CUST-1023', serial_number: 'BP500-26-10482' }],
    ['customer id (profile)', 'get_customer_profile', { customer_id: 'CUST-1042' }],
    ['customer id (orders)', 'get_customer_orders', { customer_id: 'CUST-1042' }],
    ['customer id (crm)', 'get_crm_history', { customer_id: 'CUST-1042' }],
    ['customer id (shipments)', 'get_shipments', { customer_id: 'CUST-1042' }],
    ['customer id (warranty)', 'check_warranty', { customer_id: 'CUST-1042', serial_number: 'BP500-26-10482' }],
    ['customer id (ticket)', 'create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'x', priority: 'low' }],
  ]

  it.each(cases)('%s gives forbidden and leaks no field', async (_label, tool, args) => {
    const r = await executeTool(tool, args, daniel())
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('forbidden')
    const forModel = toolResultForModel(r)
    expect(JSON.parse(forModel)).toEqual({ error: { code: 'forbidden', message: r.error.message } })
    for (const v of emmaValues) {
      expect(forModel).not.toContain(v)
      expect(r.summary).not.toContain(v)
    }
  })

  it('a refused ticket is not written', async () => {
    await executeTool('create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'x', priority: 'low' }, daniel())
    expect(await simDb.tickets.count()).toBe(0)
  })

  it('the summary says the record belongs to another customer', async () => {
    const r = await executeTool('get_shipments', { order_id: 'ORD-2026-0187' }, daniel())
    expect(r.summary).toBe('Access denied: the order belongs to another customer')
    const pl = await executeTool('get_shipments', { order_id: 'ORD-2026-0187' }, ctx('CUST-1023', 'pl'))
    expect(pl.summary).toBe('Brak dostępu: zamówienie należy do innego klienta')
  })

  it('a transferred unit belongs to its new owner only', async () => {
    const anna = await executeTool('check_warranty', { customer_id: 'CUST-1001', serial_number: 'CX900-24-03117' }, ctx('CUST-1001'))
    expect(anna.ok ? 'ok' : anna.error.code).toBe('forbidden')
    const zofia = await executeTool('check_warranty', { customer_id: 'CUST-1048', serial_number: 'CX900-24-03117' }, ctx('CUST-1048'))
    expect(ok(zofia)).toMatchObject({ status: 'active', order_id: null, transferred_on: '2025-05-10' })
    const units = ok(await executeTool('get_customer_orders', { customer_id: 'CUST-1048' }, ctx('CUST-1048'))).transferred_units
    expect(units).toEqual([expect.objectContaining({ serial_number: 'CX900-24-03117', warranty_id: 'WAR-0010' })])
  })
})

describe('not found and invalid input', () => {
  it.each([
    ['get_shipments', { order_id: 'ORD-2026-9999' }],
    ['track_shipment', { shipment_id: 'SHIP-2026-999' }],
    ['get_service_case', { case_id: 'CASE-2026-999' }],
    ['check_warranty', { customer_id: 'CUST-1042', serial_number: 'XX-00-00000' }],
    ['get_product_details', { product_id: 'PRD-COFFEE-99' }],
  ] as const)('%s with an unknown ID gives not_found', async (tool, args) => {
    const r = await executeTool(tool, { ...args }, ctx())
    expect(r.ok ? 'ok' : r.error.code).toBe('not_found')
  })

  it.each([
    ['get_customer_profile', {}],
    ['get_customer_profile', { customer_id: 42 }],
    ['get_shipments', {}],
    ['track_shipment', { shipment_id: '   ' }],
    ['create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'x', priority: 'asap' }],
  ] as const)('%s with bad arguments gives invalid_arguments', async (tool, args) => {
    const r = await executeTool(tool, { ...args } as Record<string, unknown>, ctx())
    expect(r.ok ? 'ok' : r.error.code).toBe('invalid_arguments')
  })

  it('unknown tool and non-object arguments do not throw', async () => {
    const r1 = await executeTool('drop_tables' as never, {}, ctx())
    expect(r1.ok ? 'ok' : r1.error.code).toBe('unknown_tool')
    const r2 = await executeTool('get_customer_profile', null as never, ctx())
    expect(r2.ok ? 'ok' : r2.error.code).toBe('invalid_arguments')
  })
})

describe('warranty status against SIM_TODAY', () => {
  it('expired, void and close to expiry', async () => {
    const expired = ok(await executeTool('check_warranty', { customer_id: 'CUST-1005', serial_number: 'AF5-24-20931' }, ctx('CUST-1005')))
    expect(expired).toMatchObject({ status: 'expired', end_date: '2026-02-10', days_remaining: 0, days_since_expiry: 287 })
    const voided = ok(await executeTool('check_warranty', { customer_id: 'CUST-1019', serial_number: 'BP300-25-04471' }, ctx('CUST-1019')))
    expect(voided).toMatchObject({ status: 'void', exclusion: { voided_on: '2026-06-12' } })
    const soon = ok(await executeTool('check_warranty', { customer_id: 'CUST-1008', serial_number: 'AC10-24-15502' }, ctx('CUST-1008')))
    expect(soon).toMatchObject({ status: 'active', end_date: '2026-12-02', days_remaining: 8 })
  })

  it('an overdue repair is flagged', async () => {
    const r = await executeTool('get_service_case', { case_id: 'CASE-2026-033' }, ctx('CUST-1051', 'pl'))
    expect(ok(r)).toMatchObject({ status: 'in_repair', promised_date: '2026-11-10', promised_date_passed: true })
    expect(r.summary).toBe('CASE-2026-033: w naprawie, obiecany termin minął')
  })

  it('the delayed part of S2 shows its delay', async () => {
    const r = await executeTool('get_shipments', { customer_id: 'CUST-1017' }, ctx('CUST-1017'))
    expect(r.summary).toBe('3 shipments; SHIP-2026-100: delayed')
    expect(SHIPMENTS.find((s) => s.id === 'SHIP-2026-100')?.estimatedDelivery).toBe('2026-11-26')
  })
})

describe('resetSimulation and toolResultForModel', () => {
  it('resetSimulation removes a created ticket and restores changed rows', async () => {
    await executeTool('create_service_ticket', { customer_id: 'CUST-1042', product_id: 'PRD-COFFEE-1', issue_description: 'E04', priority: 'high' }, ctx())
    await simDb.customers.update('CUST-1042', { name: 'Changed' })
    expect(await simDb.tickets.count()).toBe(1)
    await resetSimulation()
    expect(await simDb.tickets.count()).toBe(0)
    expect((await simDb.customers.get('CUST-1042'))?.name).toBe('Emma Wilson')
  })

  it('toolResultForModel sends data for a success and only { error } for a failure', async () => {
    const good = await executeTool('get_product_details', { product_id: 'PRD-AIR-2' }, ctx())
    expect(JSON.parse(toolResultForModel(good))).toMatchObject({ product_id: 'PRD-AIR-2', model: 'Northstar PureAir 300' })
    expect(toolResultForModel(good)).not.toContain(good.summary)
    const bad = await executeTool('track_shipment', { shipment_id: 'SHIP-2026-091' }, ctx('CUST-1023'))
    const sent = JSON.parse(toolResultForModel(bad))
    expect(Object.keys(sent)).toEqual(['error'])
    expect(Object.keys(sent.error).sort()).toEqual(['code', 'message'])
  })
})
