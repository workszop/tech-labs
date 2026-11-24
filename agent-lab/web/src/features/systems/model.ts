/**
 * Pure logic of the company systems explorer: groups and views, search, filters,
 * record lookup and the links between records. No React, no IndexedDB: the
 * panel passes the live table rows in (`ExplorerData`).
 */
import type { Lang } from '@shared/api-types'
import type { CompanySeed } from '@/data/company'
import type { Customer, Interaction, Localized, Order, Product, ServiceCase, Shipment, Ticket, Warranty } from '@/data/company/types'
import type { KbDocument } from '@/data/kb/types'
import { warrantyStatus } from '@/sim/tools'
import { recordKindOf, type RecordKind, type RecordRef } from './recordNav'

export { recordKindOf }
export type { RecordKind, RecordRef }

export type ExplorerData = CompanySeed & { docs: KbDocument[] }

export type GroupId = 'sales' | 'logistics' | 'crm' | 'knowledge'
export type ViewId =
  | 'customers' | 'orders' | 'products' | 'warranties'
  | 'shipments' | 'returns' | 'parts'
  | 'profiles' | 'interactions' | 'complaints' | 'cases' | 'tickets'
  | 'documents'

export const GROUPS: { id: GroupId; views: ViewId[] }[] = [
  { id: 'sales', views: ['customers', 'orders', 'products', 'warranties'] },
  { id: 'logistics', views: ['shipments', 'returns', 'parts'] },
  { id: 'crm', views: ['profiles', 'interactions', 'complaints', 'cases', 'tickets'] },
  { id: 'knowledge', views: ['documents'] },
]
export const VIEW_IDS: ViewId[] = GROUPS.flatMap((g) => g.views)

/** A CRM profile row: the customer plus what the CRM knows about the relationship. */
export interface ProfileRow {
  id: string
  customer: Customer
  interactions: number
  openCases: number
  lastContact: string | null
}

export const AUTHORITY_ORDER: KbDocument['authority'][] = ['manual', 'model_specific', 'service_bulletin', 'warranty_policy', 'support_procedure']

// ---------------------------------------------------------------- search

/** Lower case without diacritics, so "krakow" finds "Kraków" and "ZGLOSZ" finds "Zgłoszenie". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'l').toLowerCase()
}

export function matchesQuery(fields: (string | null | undefined)[], query: string): boolean {
  const q = normalize(query.trim())
  if (!q) return true
  return fields.some((f) => f != null && normalize(f).includes(q))
}

// ---------------------------------------------------------------- views

export interface FilterSpec<T> {
  key: string
  /** Option values; 'all' (when present) means "no filter". */
  options: string[]
  default: string
  /** Rendered as an on/off chip ("only the customer in the chat") instead of a select. */
  toggle?: boolean
  test: (row: T, value: string, ctx: RowCtx) => boolean
}

interface RowCtx {
  lang: Lang
  activeCustomerId: string
  data: ExplorerData
}

export interface ViewSpec<T extends { id: string }> {
  /** Kind of record a row opens. */
  kind: RecordKind
  rows: (data: ExplorerData) => T[]
  search: (row: T, ctx: RowCtx) => (string | null | undefined)[]
  filters: FilterSpec<T>[]
  /** Customer the row belongs to (rows of the customer in the chat are marked). */
  owner: (row: T) => string | null
}

const loc = (l: Localized | null | undefined, lang: Lang) => (l ? l[lang] : null)
const byDesc = <T,>(key: (r: T) => string) => (a: T, b: T) => key(b).localeCompare(key(a)) || 0

/** Name of a customer, or null for an unknown ID. */
export function customerName(data: Pick<ExplorerData, 'customers'>, id: string): string | null {
  return data.customers.find((c) => c.id === id)?.name ?? null
}
/** Full model name of a product ("Northstar Barista Pro 500"), or null for an unknown ID. */
export function productModel(data: Pick<ExplorerData, 'products'>, id: string): string | null {
  return data.products.find((p) => p.id === id)?.model ?? null
}
/** Drops the brand prefix ("Northstar ") everywhere in a text, for compact table cells and chips. */
export function shortModel(text: string): string {
  return text.replace(/Northstar\s+/g, '')
}
const nameOf = customerName
const modelOf = productModel

function mine<T>(owner: (r: T) => string | null): FilterSpec<T> {
  return { key: 'mine', options: ['all', 'yes'], default: 'all', toggle: true, test: (r, v, ctx) => v !== 'yes' || owner(r) === ctx.activeCustomerId }
}
function oneOf<T>(key: string, values: readonly string[], get: (r: T, ctx: RowCtx) => string, def = 'all'): FilterSpec<T> {
  return { key, options: ['all', ...values], default: def, test: (r, v, ctx) => v === 'all' || get(r, ctx) === v }
}

const ORDER_STATUSES: Order['status'][] = ['delivered', 'in_transit', 'awaiting_pickup', 'returned', 'cancelled']
const CATEGORIES: Product['category'][] = ['coffee_machine', 'vacuum_cleaner', 'air_purifier', 'kitchen_appliance', 'smart_home']
const SHIPMENT_STATUSES: Shipment['status'][] = ['delivered', 'in_transit', 'delayed', 'awaiting_pickup', 'returned']
const SHIPMENT_TYPES: Shipment['type'][] = ['order_delivery', 'replacement_part', 'return']
const CASE_STATUSES: ServiceCase['status'][] = ['open', 'waiting_for_part', 'in_repair', 'escalated', 'resolved']
const CHANNELS: Interaction['channel'][] = ['phone', 'email', 'chat', 'store']
const INTERACTION_TYPES: Interaction['type'][] = ['inquiry', 'service_request', 'complaint', 'follow_up', 'feedback']
const PRIORITIES: Ticket['priority'][] = ['urgent', 'high', 'normal', 'low']

export const FILTER_VALUES = { ORDER_STATUSES, CATEGORIES, SHIPMENT_STATUSES, SHIPMENT_TYPES, CASE_STATUSES, CHANNELS, INTERACTION_TYPES, PRIORITIES, AUTHORITY_ORDER }

const shipmentSpec = (type: Shipment['type'] | null): ViewSpec<Shipment> => ({
  kind: 'shipment',
  rows: (d) => d.shipments.filter((s) => !type || s.type === type).sort(byDesc((s) => s.shippedDate + s.id)),
  search: (s, { lang, data }) => [s.id, s.orderId, s.caseId, s.trackingNumber, s.carrier, s.from, s.to, loc(s.contents, lang), nameOf(data, s.customerId), s.customerId],
  filters: [oneOf('status', SHIPMENT_STATUSES, (s) => s.status), ...(type ? [] : [oneOf<Shipment>('type', SHIPMENT_TYPES, (s) => s.type)]), mine((s) => s.customerId)],
  owner: (s) => s.customerId,
})

const interactionSpec = (complaintsOnly: boolean): ViewSpec<Interaction> => ({
  kind: 'interaction',
  rows: (d) => d.interactions.filter((i) => !complaintsOnly || i.type === 'complaint').sort(byDesc((i) => i.date + i.id)),
  search: (i, { lang, data }) => [i.id, i.caseId, i.orderId, i.handledBy, loc(i.subject, lang), loc(i.summary, lang), loc(i.outcome, lang), nameOf(data, i.customerId), i.customerId],
  filters: [oneOf('channel', CHANNELS, (i) => i.channel), ...(complaintsOnly ? [] : [oneOf<Interaction>('type', INTERACTION_TYPES, (i) => i.type)]), mine((i) => i.customerId)],
  owner: (i) => i.customerId,
})

export const VIEWS: Record<ViewId, ViewSpec<any>> = {
  customers: {
    kind: 'customer',
    rows: (d) => [...d.customers].sort((a, b) => a.id.localeCompare(b.id)),
    search: (c: Customer, { lang }) => [c.id, c.name, c.email, c.phone, c.address.city, c.address.country, loc(c.notes, lang)],
    filters: [oneOf<Customer>('segment', ['consumer', 'small_business'], (c) => c.segment)],
    owner: (c: Customer) => c.id,
  } satisfies ViewSpec<Customer>,
  orders: {
    kind: 'order',
    rows: (d) => [...d.orders].sort(byDesc((o) => o.date + o.id)),
    search: (o: Order, { data }) => [o.id, o.customerId, nameOf(data, o.customerId), ...o.lines.flatMap((l) => [l.productId, modelOf(data, l.productId), l.serialNumber])],
    filters: [oneOf<Order>('status', ORDER_STATUSES, (o) => o.status), mine<Order>((o) => o.customerId)],
    owner: (o: Order) => o.customerId,
  } satisfies ViewSpec<Order>,
  products: {
    kind: 'product',
    rows: (d) => [...d.products],
    search: (p: Product, { lang }) => [p.id, p.model, p.serialPrefix, loc(p.description, lang)],
    filters: [oneOf<Product>('category', CATEGORIES, (p) => p.category), oneOf<Product>('production', ['current', 'discontinued'], (p) => (p.inProduction ? 'current' : 'discontinued'))],
    owner: () => null,
  } satisfies ViewSpec<Product>,
  warranties: {
    kind: 'warranty',
    rows: (d) => [...d.warranties].sort((a, b) => a.id.localeCompare(b.id)),
    search: (w: Warranty, { data }) => [w.id, w.serialNumber, w.orderId, w.productId, modelOf(data, w.productId), w.customerId, nameOf(data, w.customerId)],
    filters: [oneOf<Warranty>('status', ['active', 'expired', 'void'], (w) => warrantyStatus(w).status), mine<Warranty>((w) => w.customerId)],
    owner: (w: Warranty) => w.customerId,
  } satisfies ViewSpec<Warranty>,
  shipments: shipmentSpec(null),
  returns: shipmentSpec('return'),
  parts: shipmentSpec('replacement_part'),
  profiles: {
    kind: 'customer',
    rows: (d) =>
      [...d.customers]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c): ProfileRow => {
          const ints = d.interactions.filter((i) => i.customerId === c.id)
          return {
            id: c.id,
            customer: c,
            interactions: ints.length,
            openCases: d.cases.filter((k) => k.customerId === c.id && k.status !== 'resolved').length,
            lastContact: ints.map((i) => i.date).sort().at(-1) ?? null,
          }
        }),
    search: (p: ProfileRow, { lang }) => [p.id, p.customer.name, p.customer.email, p.customer.address.city, loc(p.customer.notes, lang)],
    filters: [oneOf<ProfileRow>('cases', ['open'], (p) => (p.openCases > 0 ? 'open' : 'none'))],
    owner: (p: ProfileRow) => p.id,
  } satisfies ViewSpec<ProfileRow>,
  interactions: interactionSpec(false),
  complaints: interactionSpec(true),
  cases: {
    kind: 'case',
    rows: (d) => [...d.cases].sort(byDesc((k) => k.openedDate + k.id)),
    search: (k: ServiceCase, { lang, data }) => [k.id, k.serialNumber, k.warrantyId, k.errorCode, k.productId, modelOf(data, k.productId), loc(k.fault, lang), loc(k.resolution, lang), k.customerId, nameOf(data, k.customerId)],
    filters: [
      { key: 'status', options: ['unresolved', ...CASE_STATUSES, 'all'], default: 'unresolved', test: (k, v) => v === 'all' || (v === 'unresolved' ? k.status !== 'resolved' : k.status === v) },
      mine<ServiceCase>((k) => k.customerId),
    ],
    owner: (k: ServiceCase) => k.customerId,
  } satisfies ViewSpec<ServiceCase>,
  tickets: {
    kind: 'ticket',
    rows: (d) => [...d.tickets].sort((a, b) => b.id.localeCompare(a.id)),
    search: (t: Ticket, { data }) => [t.id, t.issueDescription, t.productId, modelOf(data, t.productId), t.customerId, nameOf(data, t.customerId)],
    filters: [oneOf<Ticket>('priority', PRIORITIES, (t) => t.priority), mine<Ticket>((t) => t.customerId)],
    owner: (t: Ticket) => t.customerId,
  } satisfies ViewSpec<Ticket>,
  documents: {
    kind: 'document',
    rows: (d) => AUTHORITY_ORDER.flatMap((a) => d.docs.filter((doc) => doc.authority === a)),
    search: (doc: KbDocument) => [doc.id, doc.title, doc.body, ...doc.appliesTo],
    filters: [oneOf<KbDocument>('authority', AUTHORITY_ORDER, (doc) => doc.authority), oneOf<KbDocument>('status', ['current', 'superseded'], (doc) => doc.status)],
    owner: () => null,
  } satisfies ViewSpec<KbDocument>,
}

export interface ViewOptions {
  lang: Lang
  query: string
  /** Filter key -> value; a missing key uses the filter's default. */
  filters: Record<string, string>
  activeCustomerId: string
}

export function viewRows(view: ViewId, data: ExplorerData, o: ViewOptions): { id: string }[] {
  const spec = VIEWS[view]
  const ctx: RowCtx = { lang: o.lang, activeCustomerId: o.activeCustomerId, data }
  return spec.rows(data).filter((r) => spec.filters.every((f) => f.test(r, o.filters[f.key] ?? f.default, ctx)) && matchesQuery(spec.search(r, ctx), o.query))
}

// ---------------------------------------------------------------- records and links

export function findRecord(ref: RecordRef, data: ExplorerData): unknown | null {
  const table: Record<RecordKind, { id: string }[]> = {
    order: data.orders,
    customer: data.customers,
    product: data.products,
    warranty: data.warranties,
    shipment: data.shipments,
    case: data.cases,
    interaction: data.interactions,
    ticket: data.tickets,
    document: data.docs,
  }
  return table[ref.kind].find((r) => r.id === ref.id) ?? null
}

/** Customer a record belongs to; null for products and documents (and unknown records). */
export function ownerOf(ref: RecordRef, data: ExplorerData): string | null {
  if (ref.kind === 'customer') return data.customers.some((c) => c.id === ref.id) ? ref.id : null
  if (ref.kind === 'product' || ref.kind === 'document') return null
  const r = findRecord(ref, data) as { customerId?: string } | null
  return r?.customerId ?? null
}

/** Records linked to this one (shown as clickable chips), in a readable order, without duplicates. */
export function linksOf(ref: RecordRef, data: ExplorerData): RecordRef[] {
  const out: RecordRef[] = []
  const add = (kind: RecordKind, id: string | null | undefined) => {
    if (!id || (kind === ref.kind && id === ref.id)) return
    if (!out.some((l) => l.kind === kind && l.id === id)) out.push({ kind, id })
  }
  const docsFor = (model: string) => data.docs.filter((d) => d.appliesTo.includes(model)).forEach((d) => add('document', d.id))
  switch (ref.kind) {
    case 'customer': {
      const id = ref.id
      data.orders.filter((o) => o.customerId === id).forEach((o) => add('order', o.id))
      data.warranties.filter((w) => w.customerId === id).forEach((w) => add('warranty', w.id))
      data.shipments.filter((s) => s.customerId === id).forEach((s) => add('shipment', s.id))
      data.cases.filter((k) => k.customerId === id).forEach((k) => add('case', k.id))
      data.interactions.filter((i) => i.customerId === id).forEach((i) => add('interaction', i.id))
      data.tickets.filter((t) => t.customerId === id).forEach((t) => add('ticket', t.id))
      break
    }
    case 'order': {
      const o = data.orders.find((x) => x.id === ref.id)
      if (!o) break
      add('customer', o.customerId)
      o.lines.forEach((l) => add('product', l.productId))
      o.lines.forEach((l) => add('warranty', l.warrantyId))
      data.shipments.filter((s) => s.orderId === o.id).forEach((s) => add('shipment', s.id))
      data.interactions.filter((i) => i.orderId === o.id).forEach((i) => add('interaction', i.id))
      break
    }
    case 'product': {
      const p = data.products.find((x) => x.id === ref.id)
      if (!p) break
      docsFor(p.model)
      data.cases.filter((k) => k.productId === p.id).forEach((k) => add('case', k.id))
      break
    }
    case 'warranty': {
      const w = data.warranties.find((x) => x.id === ref.id)
      if (!w) break
      add('customer', w.customerId)
      add('customer', w.transfer?.fromCustomerId)
      add('product', w.productId)
      add('order', w.orderId)
      data.cases.filter((k) => k.warrantyId === w.id).forEach((k) => add('case', k.id))
      break
    }
    case 'shipment': {
      const s = data.shipments.find((x) => x.id === ref.id)
      if (!s) break
      add('customer', s.customerId)
      add('order', s.orderId)
      add('case', s.caseId)
      break
    }
    case 'case': {
      const k = data.cases.find((x) => x.id === ref.id)
      if (!k) break
      add('customer', k.customerId)
      add('product', k.productId)
      add('warranty', k.warrantyId)
      k.shipmentIds.forEach((id) => add('shipment', id))
      data.shipments.filter((s) => s.caseId === k.id).forEach((s) => add('shipment', s.id))
      data.interactions.filter((i) => i.caseId === k.id).forEach((i) => add('interaction', i.id))
      break
    }
    case 'interaction': {
      const i = data.interactions.find((x) => x.id === ref.id)
      if (!i) break
      add('customer', i.customerId)
      add('case', i.caseId)
      add('order', i.orderId)
      break
    }
    case 'ticket': {
      const t = data.tickets.find((x) => x.id === ref.id)
      if (!t) break
      add('customer', t.customerId)
      add('product', t.productId)
      break
    }
    case 'document': {
      const d = data.docs.find((x) => x.id === ref.id)
      if (!d) break
      add('document', d.supersededBy)
      data.docs.filter((x) => x.supersededBy === d.id).forEach((x) => add('document', x.id))
      d.appliesTo.forEach((model) => add('product', data.products.find((p) => p.model === model)?.id))
      break
    }
  }
  return out
}
