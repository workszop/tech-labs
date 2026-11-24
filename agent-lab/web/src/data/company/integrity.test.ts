import { describe, expect, it } from 'vitest'
import { SIM_TODAY } from '@shared/sim'
import { SCENARIOS } from '../scenarios'
import { CASES, COMPANY_SEED, CUSTOMERS, INTERACTIONS, ORDERS, PRODUCTS, SHIPMENTS, WARRANTIES } from './index'
import { addMonths } from './warranties'

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))
const customers = byId(CUSTOMERS)
const products = byId(PRODUCTS)
const orders = byId(ORDERS)
const warranties = byId(WARRANTIES)
const shipments = byId(SHIPMENTS)
const cases = byId(CASES)

/** R9 volumes; the data must stay within 10 %. */
const R9 = { customers: 20, products: 30, orders: 50, warranties: 40, cases: 30, shipments: 40, interactions: 50 } as const

function allLocalized(v: unknown, path: string, out: string[]): void {
  if (Array.isArray(v)) return v.forEach((x, i) => allLocalized(x, `${path}[${i}]`, out))
  if (v && typeof v === 'object') {
    const keys = Object.keys(v)
    if (keys.includes('pl') || keys.includes('en')) {
      const l = v as Record<string, unknown>
      if (typeof l.pl !== 'string' || !l.pl.trim() || typeof l.en !== 'string' || !l.en.trim()) out.push(path)
      return
    }
    for (const [k, x] of Object.entries(v)) allLocalized(x, `${path}.${k}`, out)
  }
}

describe('company data volumes (R9)', () => {
  it.each(Object.entries(R9))('%s within 10%% of %i', (table, expected) => {
    const n = (COMPANY_SEED as unknown as Record<string, unknown[]>)[table].length
    expect(n).toBeGreaterThanOrEqual(Math.floor(expected * 0.9))
    expect(n).toBeLessThanOrEqual(Math.ceil(expected * 1.1))
  })
  it('IDs are unique in every table', () => {
    for (const rows of Object.values(COMPANY_SEED) as { id: string }[][]) expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })
  it('IDs follow the agreed formats and match the tool argument patterns', () => {
    for (const c of CUSTOMERS) expect(c.id).toMatch(/^CUST-\d{4}$/)
    for (const p of PRODUCTS) expect(p.id).toMatch(/^PRD-[A-Z]+-\d+$/)
    for (const o of ORDERS) expect(o.id).toMatch(new RegExp(`^ORD-${o.date.slice(0, 4)}-\\d{4}$`))
    for (const w of WARRANTIES) expect(w.id).toMatch(/^WAR-\d{4}$/)
    for (const s of SHIPMENTS) expect(s.id).toMatch(new RegExp(`^SHIP-${s.shippedDate.slice(0, 4)}-\\d{3}$`))
    for (const c of CASES) expect(c.id).toMatch(new RegExp(`^CASE-${c.openedDate.slice(0, 4)}-\\d{3}$`))
    for (const i of INTERACTIONS) expect(i.id).toMatch(/^INT-\d{4}$/)
  })
})

describe('anchor record (R9)', () => {
  it('Emma Wilson, ORD-2026-0187, Barista Pro 500, BP500-26-10482, 2026-03-12, 24 months, CASE-2026-031, SHIP-2026-091', () => {
    expect(customers.get('CUST-1042')?.name).toBe('Emma Wilson')
    const order = orders.get('ORD-2026-0187')!
    expect(order.customerId).toBe('CUST-1042')
    expect(order.date).toBe('2026-03-12')
    const line = order.lines.find((l) => l.serialNumber === 'BP500-26-10482')!
    expect(products.get(line.productId)?.model).toBe('Northstar Barista Pro 500')
    const w = warranties.get(line.warrantyId!)!
    expect(w.months).toBe(24)
    expect(w.startDate).toBe('2026-03-12')
    expect(w.endDate).toBe('2028-03-12')
    expect(cases.get('CASE-2026-031')).toMatchObject({ customerId: 'CUST-1042', serialNumber: 'BP500-26-10482' })
    expect(shipments.get('SHIP-2026-091')).toMatchObject({ customerId: 'CUST-1042', type: 'replacement_part', caseId: 'CASE-2026-031', orderId: 'ORD-2026-0187' })
    expect(products.get('PRD-AIR-2')?.model).toBe('Northstar PureAir 300')
  })
})

describe('referential integrity', () => {
  it('orders: customer and products exist; serialised lines carry a warranty unless returned or cancelled', () => {
    for (const o of ORDERS) {
      expect(customers.has(o.customerId), o.id).toBe(true)
      expect(o.lines.length, o.id).toBeGreaterThan(0)
      for (const l of o.lines) {
        const p = products.get(l.productId)
        expect(p, `${o.id} ${l.productId}`).toBeDefined()
        if (p!.kind === 'accessory') expect([l.serialNumber, l.warrantyId], o.id).toEqual([null, null])
        if (p!.kind === 'appliance' && o.status !== 'cancelled') {
          expect(l.serialNumber, o.id).toMatch(new RegExp(`^${p!.serialPrefix}-\\d{2}-\\d{5}$`))
          expect(l.quantity).toBe(1)
        }
        if (o.status === 'returned' || o.status === 'cancelled') expect(l.warrantyId, o.id).toBeNull()
        else if (p!.kind === 'appliance') expect(l.warrantyId, o.id).not.toBeNull()
      }
      const total = Math.round(o.lines.reduce((s, l) => s + l.quantity * l.unitPriceEur, 0) * 100) / 100
      expect(o.totalEur).toBe(total)
    }
  })

  it('order lines and warranties point at each other (both ways)', () => {
    const linesByWarranty = new Map<string, { orderId: string; serial: string | null; productId: string }>()
    for (const o of ORDERS) for (const l of o.lines) if (l.warrantyId) linesByWarranty.set(l.warrantyId, { orderId: o.id, serial: l.serialNumber, productId: l.productId })
    expect(linesByWarranty.size).toBe(WARRANTIES.length)
    for (const w of WARRANTIES) {
      const line = linesByWarranty.get(w.id)
      expect(line, w.id).toBeDefined()
      expect(line).toEqual({ orderId: w.orderId, serial: w.serialNumber, productId: w.productId })
      const order = orders.get(w.orderId)!
      expect(customers.has(w.customerId)).toBe(true)
      if (w.transfer) {
        expect(w.transfer.fromCustomerId).toBe(order.customerId)
        expect(w.customerId).not.toBe(order.customerId)
        expect(w.transfer.date >= w.startDate).toBe(true)
      } else {
        expect(w.customerId).toBe(order.customerId)
      }
    }
  })

  it('serial numbers are unique', () => {
    const serials = ORDERS.flatMap((o) => o.lines.map((l) => l.serialNumber)).filter((s): s is string => s !== null)
    expect(new Set(serials).size).toBe(serials.length)
  })

  it('warranty starts on the purchase date and lasts the product warranty period', () => {
    for (const w of WARRANTIES) {
      const p = products.get(w.productId)!
      expect(w.startDate).toBe(orders.get(w.orderId)!.date)
      expect(w.months).toBe(p.warrantyMonths)
      expect([12, 24, 36]).toContain(w.months)
      expect(w.endDate).toBe(addMonths(w.startDate, w.months))
    }
  })

  it('covers the warranty edge cases: expired, void by exclusion, one transfer, active', () => {
    expect(WARRANTIES.filter((w) => w.endDate < SIM_TODAY).length).toBeGreaterThanOrEqual(5)
    expect(WARRANTIES.filter((w) => w.voided).length).toBeGreaterThanOrEqual(1)
    expect(WARRANTIES.filter((w) => w.transfer).length).toBe(1)
    expect(PRODUCTS.filter((p) => !p.inProduction).length).toBeGreaterThanOrEqual(3)
    expect(new Set(PRODUCTS.map((p) => p.category))).toEqual(new Set(['coffee_machine', 'vacuum_cleaner', 'air_purifier', 'kitchen_appliance', 'smart_home']))
  })

  it('products out of production were not sold after their discontinuation', () => {
    for (const o of ORDERS)
      for (const l of o.lines) {
        const p = products.get(l.productId)!
        if (p.discontinued) expect(o.date <= p.discontinued, `${o.id} ${p.model}`).toBe(true)
        expect(Number(o.date.slice(0, 4))).toBeGreaterThanOrEqual(p.launchYear)
      }
  })

  it('shipments: customer, order and case exist and agree', () => {
    for (const s of SHIPMENTS) {
      expect(customers.has(s.customerId), s.id).toBe(true)
      if (s.orderId) expect(orders.get(s.orderId)?.customerId, s.id).toBe(s.customerId)
      if (s.type === 'replacement_part') {
        const c = cases.get(s.caseId!)
        expect(c?.customerId, s.id).toBe(s.customerId)
        expect(c?.shipmentIds, s.id).toContain(s.id)
      } else {
        expect(s.caseId, s.id).toBeNull()
      }
      if (s.type === 'return') expect(orders.get(s.orderId!)?.status).toBe('returned')
    }
  })

  it('every online order (not cancelled) has a delivery shipment; store and partner sales have none', () => {
    for (const o of ORDERS) {
      const deliveries = SHIPMENTS.filter((s) => s.type === 'order_delivery' && s.orderId === o.id)
      if (o.channel === 'online' && o.status !== 'cancelled') {
        expect(deliveries.length, o.id).toBeGreaterThan(0)
        const latest = deliveries.sort((a, b) => a.shippedDate.localeCompare(b.shippedDate)).at(-1)!
        const expected = o.status === 'returned' ? 'delivered' : o.status
        expect(latest.status, o.id).toBe(expected)
      } else {
        expect(deliveries, o.id).toEqual([])
      }
    }
  })

  it('shipments cover every status and type; events are ordered and dated before SIM_TODAY', () => {
    expect(new Set(SHIPMENTS.map((s) => s.status))).toEqual(new Set(['delivered', 'in_transit', 'delayed', 'awaiting_pickup', 'returned']))
    expect(new Set(SHIPMENTS.map((s) => s.type))).toEqual(new Set(['order_delivery', 'replacement_part', 'return']))
    for (const s of SHIPMENTS) {
      expect(s.events.length, s.id).toBeGreaterThan(0)
      const ats = s.events.map((e) => e.at)
      expect([...ats].sort(), s.id).toEqual(ats)
      expect(ats[0].slice(0, 10), s.id).toBe(s.shippedDate)
      for (const at of ats) {
        expect(at, s.id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
        expect(at.slice(0, 10) <= SIM_TODAY, `${s.id} ${at}`).toBe(true)
      }
      if (s.deliveredDate) {
        expect(s.deliveredDate <= SIM_TODAY).toBe(true)
        expect(ats.at(-1)!.slice(0, 10), s.id).toBe(s.deliveredDate)
      }
      if (s.status === 'delivered') expect(s.deliveredDate, s.id).not.toBeNull()
      if (s.status === 'in_transit' || s.status === 'delayed' || s.status === 'awaiting_pickup') expect(s.deliveredDate, s.id).toBeNull()
      if (s.orderId) expect(s.shippedDate >= orders.get(s.orderId)!.date, s.id).toBe(true)
    }
  })

  it('service cases: customer owns the unit, warranty and product agree, shipments point back', () => {
    const statuses = new Set(CASES.map((c) => c.status))
    expect(statuses).toEqual(new Set(['open', 'waiting_for_part', 'in_repair', 'resolved', 'escalated']))
    for (const c of CASES) {
      const w = warranties.get(c.warrantyId)
      expect(w, c.id).toBeDefined()
      expect(w!.serialNumber).toBe(c.serialNumber)
      expect(w!.productId).toBe(c.productId)
      expect(w!.customerId, c.id).toBe(c.customerId)
      expect(c.openedDate >= w!.startDate, c.id).toBe(true)
      expect(c.openedDate <= SIM_TODAY, c.id).toBe(true)
      if (w!.transfer) expect(c.openedDate >= w!.transfer.date).toBe(true)
      const inWarranty = c.openedDate <= w!.endDate && !w!.voided
      expect(c.coveredByWarranty, c.id).toBe(inWarranty)
      for (const sid of c.shipmentIds) expect(shipments.get(sid)?.caseId, c.id).toBe(c.id)
      if (c.status === 'resolved') {
        expect(c.resolvedDate, c.id).not.toBeNull()
        expect(c.resolution, c.id).not.toBeNull()
      } else {
        expect(c.resolvedDate, c.id).toBeNull()
      }
      expect(c.history[0].date, c.id).toBe(c.openedDate)
      for (const h of c.history) expect(h.date >= c.openedDate && h.date <= SIM_TODAY, `${c.id} ${h.date}`).toBe(true)
    }
  })

  it('interactions: customer exists; referenced cases and orders belong to that customer; every case has one', () => {
    for (const i of INTERACTIONS) {
      expect(customers.has(i.customerId), i.id).toBe(true)
      expect(i.date <= SIM_TODAY, i.id).toBe(true)
      if (i.caseId) expect(cases.get(i.caseId)?.customerId, i.id).toBe(i.customerId)
      if (i.orderId) expect(orders.get(i.orderId)?.customerId, i.id).toBe(i.customerId)
    }
    const dates = INTERACTIONS.map((i) => i.date)
    expect([...dates].sort()).toEqual(dates)
    for (const c of CASES) expect(INTERACTIONS.some((i) => i.caseId === c.id), c.id).toBe(true)
  })

  it('every customer has at least one order or transferred unit, and joined before the first purchase', () => {
    for (const c of CUSTOMERS) {
      const own = ORDERS.filter((o) => o.customerId === c.id)
      const held = WARRANTIES.filter((w) => w.customerId === c.id)
      expect(own.length + held.length, c.id).toBeGreaterThan(0)
      for (const o of own) expect(c.customerSince <= o.date, c.id).toBe(true)
      expect(c.email).toMatch(/@example\.com$/)
    }
  })

  it('no record date lies after SIM_TODAY', () => {
    for (const o of ORDERS) expect(o.date <= SIM_TODAY).toBe(true)
    for (const s of SHIPMENTS) expect(s.shippedDate <= SIM_TODAY).toBe(true)
    for (const w of WARRANTIES) if (w.voided) expect(w.voided.date <= SIM_TODAY).toBe(true)
  })

  it('every Localized field has both languages', () => {
    const missing: string[] = []
    allLocalized(COMPANY_SEED, 'seed', missing)
    allLocalized(SCENARIOS, 'scenarios', missing)
    expect(missing).toEqual([])
  })

  it('no em-dash in any text', () => {
    expect(JSON.stringify(COMPANY_SEED) + JSON.stringify(SCENARIOS)).not.toContain(String.fromCharCode(0x2014))
  })
})

describe('scenarios (R23)', () => {
  it('nine scenarios with existing customers and distinct IDs', () => {
    expect(SCENARIOS).toHaveLength(9)
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(9)
    for (const s of SCENARIOS) {
      expect(customers.has(s.customerId), s.id).toBe(true)
      expect(s.expectTools.length).toBeGreaterThan(0)
    }
  })

  it('backing records exist for every scenario', () => {
    const owned = (cid: string, productId: string) => WARRANTIES.filter((w) => w.customerId === cid && w.productId === productId)
    // S2 delayed replacement part
    expect(SHIPMENTS.some((s) => s.customerId === 'CUST-1017' && s.type === 'replacement_part' && s.status === 'delayed')).toBe(true)
    // S3 vacuum warranty close to expiry (active, under 30 days left)
    const v = owned('CUST-1008', 'PRD-VAC-2')[0]
    expect(v.endDate >= SIM_TODAY && v.endDate <= addMonths(SIM_TODAY, 1)).toBe(true)
    // S4 two earlier cases for the same fault on the same unit
    const s4 = CASES.filter((c) => c.customerId === 'CUST-1029' && c.errorCode === 'E07')
    expect(s4).toHaveLength(2)
    expect(new Set(s4.map((c) => c.serialNumber)).size).toBe(1)
    // S5 PureAir 300
    expect(owned('CUST-1033', 'PRD-AIR-2')).toHaveLength(1)
    // S6 repair overdue with a complaint
    const s6 = CASES.find((c) => c.customerId === 'CUST-1051' && c.status === 'in_repair')!
    expect(s6.promisedDate! < SIM_TODAY).toBe(true)
    expect(INTERACTIONS.some((i) => i.caseId === s6.id && i.type === 'complaint')).toBe(true)
    // S7 three appliances, two coffee machines
    const s7 = WARRANTIES.filter((w) => w.customerId === 'CUST-1036')
    expect(s7).toHaveLength(3)
    expect(s7.filter((w) => products.get(w.productId)!.category === 'coffee_machine')).toHaveLength(2)
    // S8 out-of-warranty kitchen appliance
    const s8 = WARRANTIES.filter((w) => w.customerId === 'CUST-1005' && products.get(w.productId)!.category === 'kitchen_appliance')
    expect(s8.length).toBe(1)
    expect(s8[0].endDate < SIM_TODAY).toBe(true)
    // S9 asks about another customer's order
    expect(orders.get('ORD-2026-0187')!.customerId).not.toBe(SCENARIOS.find((s) => s.id === 'access-control')!.customerId)
  })
})
