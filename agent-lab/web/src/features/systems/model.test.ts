import { describe, expect, it } from 'vitest'
import { COMPANY_SEED } from '@/data/company'
import type { Ticket } from '@/data/company/types'
import { kbDocuments } from '@/data/kb'
import { GROUPS, VIEW_IDS, findRecord, linksOf, matchesQuery, ownerOf, recordKindOf, viewRows, type ExplorerData } from './model'

const data: ExplorerData = { ...structuredClone(COMPANY_SEED), docs: kbDocuments('en') }
const opts = { lang: 'en' as const, query: '', filters: {}, activeCustomerId: 'CUST-1042' }
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('explorer groups and views', () => {
  it('has four groups and thirteen views, each view in exactly one group', () => {
    expect(GROUPS.map((g) => g.id)).toEqual(['sales', 'logistics', 'crm', 'knowledge'])
    const all = GROUPS.flatMap((g) => g.views)
    expect(all).toHaveLength(13)
    expect(new Set(all)).toEqual(new Set(VIEW_IDS))
  })

  it('every view returns rows from the seed (tickets start empty)', () => {
    for (const v of VIEW_IDS) {
      const n = viewRows(v, data, opts).length
      if (v === 'tickets') expect(n).toBe(0)
      else expect(n, v).toBeGreaterThan(0)
    }
  })

  it('returns and replacement parts are subsets of shipments by type', () => {
    expect(viewRows('returns', data, opts).every((s) => (s as unknown as { type: string }).type === 'return')).toBe(true)
    expect(ids(viewRows('returns', data, opts))).toEqual(expect.arrayContaining(['SHIP-2025-042', 'SHIP-2026-101']))
    expect(ids(viewRows('parts', data, opts))).toContain('SHIP-2026-100')
    expect(viewRows('shipments', data, opts)).toHaveLength(data.shipments.length)
  })

  it('open cases hide resolved cases by default and show them with the "all" filter', () => {
    const open = ids(viewRows('cases', data, opts))
    expect(open).toContain('CASE-2026-033')
    expect(open).not.toContain('CASE-2026-031') // resolved
    expect(ids(viewRows('cases', data, { ...opts, filters: { status: 'all' } }))).toContain('CASE-2026-031')
    expect(ids(viewRows('cases', data, { ...opts, filters: { status: 'escalated' } }))).toEqual(expect.arrayContaining(['CASE-2026-035', 'CASE-2026-037']))
  })

  it('complaints are interactions of type complaint', () => {
    const rows = viewRows('complaints', data, opts)
    expect(rows.length).toBeGreaterThan(0)
    expect(ids(rows)).toEqual(expect.arrayContaining(['INT-0031', 'INT-0049']))
    expect(rows.every((r) => (r as unknown as { type: string }).type === 'complaint')).toBe(true)
  })

  it('a ticket written to the data shows up in the tickets view', () => {
    const t: Ticket = { id: 'TCK-2026-0001', customerId: 'CUST-1005', productId: 'PRD-KITCHEN-2', issueDescription: 'Air fryer switches off', priority: 'normal', status: 'open', createdDate: '2026-11-24', createdBy: 'agent' }
    expect(ids(viewRows('tickets', { ...data, tickets: [t] }, opts))).toEqual(['TCK-2026-0001'])
  })

  it('documents are ordered by authority group and filter by status', () => {
    const rows = viewRows('documents', data, opts) as unknown as { authority: string }[]
    const order = rows.map((r) => r.authority)
    const firstSeen = [...new Set(order)]
    // each authority forms one contiguous block
    expect(firstSeen.length).toBe(new Set(order).size)
    for (const a of firstSeen) {
      const idx = order.map((x, i) => (x === a ? i : -1)).filter((i) => i >= 0)
      expect(idx.at(-1)! - idx[0]! + 1).toBe(idx.length)
    }
    expect(ids(viewRows('documents', data, { ...opts, filters: { status: 'superseded' } }))).toEqual(['DOC-pureair-sensor-calibration-2025'])
  })
})

describe('search', () => {
  it('matches case- and diacritics-insensitively', () => {
    expect(matchesQuery(['Anna Kowalska', 'Kraków'], 'krakow')).toBe(true)
    expect(matchesQuery(['Zgłoszenie'], 'ZGLOSZ')).toBe(true)
    expect(matchesQuery(['Emma Wilson'], 'xyz')).toBe(false)
    expect(matchesQuery(['Emma Wilson'], '  ')).toBe(true)
  })

  it('filters rows by ID, name, serial number and model name', () => {
    expect(ids(viewRows('orders', data, { ...opts, query: 'ORD-2026-0187' }))).toEqual(['ORD-2026-0187'])
    expect(ids(viewRows('customers', data, { ...opts, query: 'wilson' }))).toEqual(['CUST-1042'])
    expect(ids(viewRows('warranties', data, { ...opts, query: 'BP500-26-10482' }))).toEqual(['WAR-0031'])
    expect(ids(viewRows('products', data, { ...opts, query: 'barista pro 500' }))).toContain('PRD-COFFEE-1')
    expect(viewRows('orders', data, { ...opts, query: 'no such thing at all' })).toEqual([])
  })

  it('searches localized text in the active language', () => {
    const pl = { ...opts, lang: 'pl' as const }
    const plData = { ...data, docs: kbDocuments('pl') }
    expect(viewRows('documents', plData, { ...pl, query: 'gwarancj' }).length).toBeGreaterThan(0)
  })

  it('the "this customer" filter keeps only the active customer\'s records', () => {
    const rows = viewRows('orders', data, { ...opts, filters: { mine: 'yes' } }) as unknown as { customerId: string }[]
    expect(rows.length).toBe(2)
    expect(rows.every((r) => r.customerId === 'CUST-1042')).toBe(true)
  })

  it('warranty status filter uses the simulation date', () => {
    const active = ids(viewRows('warranties', data, { ...opts, filters: { status: 'active' } }))
    expect(active).toContain('WAR-0031')
    expect(active).not.toContain('WAR-0008') // expired 2026-03-16
    expect(ids(viewRows('warranties', data, { ...opts, filters: { status: 'void' } }))).toEqual(['WAR-0016'])
  })
})

describe('records and links', () => {
  it('infers the record kind from an ID', () => {
    expect(recordKindOf('ORD-2026-0187')).toBe('order')
    expect(recordKindOf('CUST-1042')).toBe('customer')
    expect(recordKindOf('PRD-COFFEE-1')).toBe('product')
    expect(recordKindOf('WAR-0031')).toBe('warranty')
    expect(recordKindOf('SHIP-2026-023')).toBe('shipment')
    expect(recordKindOf('CASE-2026-031')).toBe('case')
    expect(recordKindOf('INT-0016')).toBe('interaction')
    expect(recordKindOf('TCK-2026-0001')).toBe('ticket')
    expect(recordKindOf('DOC-warranty-terms')).toBe('document')
    expect(recordKindOf('hello')).toBeNull()
  })

  it('an order links its customer, products, warranties and shipments', () => {
    const links = linksOf({ kind: 'order', id: 'ORD-2026-0187' }, data)
    expect(links).toEqual(expect.arrayContaining([
      { kind: 'customer', id: 'CUST-1042' },
      { kind: 'product', id: 'PRD-COFFEE-1' },
      { kind: 'warranty', id: 'WAR-0031' },
      { kind: 'shipment', id: 'SHIP-2026-023' },
    ]))
    // every link resolves to an existing record
    for (const l of links) expect(findRecord(l, data), `${l.kind} ${l.id}`).not.toBeNull()
  })

  it('a case links customer, product, warranty, part shipment and interactions', () => {
    const links = linksOf({ kind: 'case', id: 'CASE-2026-034' }, data)
    expect(links).toEqual(expect.arrayContaining([
      { kind: 'customer', id: 'CUST-1017' },
      { kind: 'warranty', id: 'WAR-0024' },
      { kind: 'shipment', id: 'SHIP-2026-100' },
    ]))
    expect(links.some((l) => l.kind === 'interaction')).toBe(true)
  })

  it('a customer links orders, cases and interactions; a transferred warranty links both owners', () => {
    const c = linksOf({ kind: 'customer', id: 'CUST-1042' }, data)
    expect(c).toEqual(expect.arrayContaining([{ kind: 'order', id: 'ORD-2026-0187' }, { kind: 'case', id: 'CASE-2026-031' }, { kind: 'interaction', id: 'INT-0016' }]))
    const w = linksOf({ kind: 'warranty', id: 'WAR-0010' }, data)
    expect(w).toEqual(expect.arrayContaining([{ kind: 'customer', id: 'CUST-1048' }, { kind: 'customer', id: 'CUST-1001' }]))
  })

  it('a superseded document links its successor, and a product links the documents that apply to it', () => {
    expect(linksOf({ kind: 'document', id: 'DOC-pureair-sensor-calibration-2025' }, data)).toContainEqual({ kind: 'document', id: 'DOC-sb-2026-07' })
    expect(linksOf({ kind: 'product', id: 'PRD-COFFEE-1' }, data)).toContainEqual({ kind: 'document', id: 'DOC-bp500-e04-troubleshooting' })
  })

  it('links contain no duplicates and never the record itself', () => {
    for (const ref of [{ kind: 'customer', id: 'CUST-1036' }, { kind: 'order', id: 'ORD-2026-0187' }, { kind: 'case', id: 'CASE-2026-033' }] as const) {
      const keys = linksOf(ref, data).map((l) => `${l.kind}:${l.id}`)
      expect(new Set(keys).size).toBe(keys.length)
      expect(keys).not.toContain(`${ref.kind}:${ref.id}`)
    }
  })

  it('finds the owner of a record (for the active-customer marker)', () => {
    expect(ownerOf({ kind: 'order', id: 'ORD-2026-0187' }, data)).toBe('CUST-1042')
    expect(ownerOf({ kind: 'customer', id: 'CUST-1042' }, data)).toBe('CUST-1042')
    expect(ownerOf({ kind: 'product', id: 'PRD-COFFEE-1' }, data)).toBeNull()
    expect(findRecord({ kind: 'order', id: 'ORD-9999-0000' }, data)).toBeNull()
  })
})
