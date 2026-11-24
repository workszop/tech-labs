/**
 * Table columns of the thirteen explorer views. `show` decides from which panel
 * width a column appears (container queries), so a narrow panel or a phone keeps
 * the ID, the main text and the status, and a wide panel shows the rest.
 */
import type * as React from 'react'
import type { Lang } from '@shared/api-types'
import type { Customer, Interaction, Order, Product, ServiceCase, Shipment, Ticket, Warranty } from '@/data/company/types'
import type { KbDocument } from '@/data/kb/types'
import type { Dict } from '@/i18n'
import { warrantyStatus } from '@/sim/tools'
import type { ExplorerData, ProfileRow, ViewId } from './model'
import { StatusChip, TONES, fmtDate, fmtEur } from './ui'

export interface CellCtx {
  tx: Dict['systems']
  lang: Lang
  data: ExplorerData
}

export interface Column<T> {
  key: string
  head: (tx: Dict['systems']) => string
  cell: (row: T, c: CellCtx) => React.ReactNode
  /** Plain text of a truncated cell, shown in full as a tooltip. */
  title?: (row: T, c: CellCtx) => string
  /** `grow`: takes the free width and truncates. */
  grow?: boolean
  /** From which panel width the column is shown. */
  show?: 'always' | 'md' | 'lg'
  align?: 'right'
}

const cname = (c: CellCtx, id: string) => c.data.customers.find((x) => x.id === id)?.name ?? id
const model = (c: CellCtx, id: string) => c.data.products.find((x) => x.id === id)?.model ?? id
const short = (model: string) => model.replace(/^Northstar\s+/, '')

/** Main text with a muted second line; both truncate. */
function Two({ main, sub, mono }: { main: React.ReactNode; sub?: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <div className="truncate text-foreground">{main}</div>
      {sub && <div className={mono ? 'truncate font-mono text-[11px] text-muted-foreground' : 'truncate text-[11.5px] text-muted-foreground'}>{sub}</div>}
    </>
  )
}

const id = <T extends { id: string }>(): Column<T> => ({ key: 'id', head: (t) => t.columns.id, cell: (r) => r.id })

const shipmentCols = (withType: boolean, withCase: boolean): Column<Shipment>[] => [
  id<Shipment>(),
  {
    key: 'contents',
    head: (t) => t.columns.contents,
    grow: true,
    cell: (s, c) => <Two main={s.contents[c.lang].replace(/Northstar\s+/g, '')} sub={`${cname(c, s.customerId)} · ${s.carrier}`} />,
    title: (s, c) => s.contents[c.lang],
  },
  ...(withType ? [{ key: 'type', head: (t: Dict['systems']) => t.columns.type, show: 'lg' as const, cell: (s: Shipment, c: CellCtx) => c.tx.enums.shipmentType[s.type] }] : []),
  ...(withCase ? [{ key: 'case', head: (t: Dict['systems']) => t.columns.case, show: 'md' as const, cell: (s: Shipment) => <span className="font-mono text-[12px]">{s.caseId ?? '-'}</span> }] : []),
  { key: 'eta', head: (t) => t.columns.eta, show: 'md', cell: (s) => fmtDate(s.deliveredDate ?? s.estimatedDelivery) },
  { key: 'status', head: (t) => t.columns.status, cell: (s, c) => <StatusChip tone={TONES.shipment[s.status]}>{c.tx.enums.shipmentStatus[s.status]}</StatusChip> },
]

const interactionCols = (withType: boolean): Column<Interaction>[] => [
  id<Interaction>(),
  {
    key: 'subject',
    head: (t) => t.columns.subject,
    grow: true,
    cell: (i, c) => <Two main={i.subject[c.lang]} sub={`${cname(c, i.customerId)} · ${c.tx.enums.channel[i.channel]}`} />,
    title: (i, c) => `${i.subject[c.lang]} - ${i.summary[c.lang]}`,
  },
  { key: 'date', head: (t) => t.columns.date, show: 'md', cell: (i) => fmtDate(i.date) },
  withType
    ? { key: 'type', head: (t) => t.columns.type, cell: (i, c) => (i.type === 'complaint' ? <StatusChip tone="danger">{c.tx.enums.interactionType[i.type]}</StatusChip> : <span className="text-[12px]">{c.tx.enums.interactionType[i.type]}</span>) }
    : { key: 'case', head: (t) => t.columns.case, show: 'md', cell: (i) => <span className="font-mono text-[12px]">{i.caseId ?? '-'}</span> },
]

export const COLUMNS: Record<ViewId, Column<any>[]> = {
  customers: [
    id<Customer>(),
    { key: 'name', head: (t) => t.columns.name, grow: true, cell: (r: Customer) => <Two main={r.name} sub={`${r.address.city}, ${r.address.country}`} /> },
    { key: 'segment', head: (t) => t.columns.segment, show: 'md', cell: (r: Customer, c) => c.tx.enums.segment[r.segment] },
    { key: 'since', head: (t) => t.columns.since, show: 'lg', cell: (r: Customer) => fmtDate(r.customerSince) },
  ] satisfies Column<Customer>[],
  orders: [
    id<Order>(),
    {
      key: 'customer',
      head: (t) => t.columns.customer,
      grow: true,
      cell: (o: Order, c) => <Two main={cname(c, o.customerId)} sub={o.lines.map((l) => short(model(c, l.productId))).join(', ')} />,
      title: (o: Order, c) => o.lines.map((l) => model(c, l.productId)).join(', '),
    },
    { key: 'date', head: (t) => t.columns.date, show: 'md', cell: (o: Order) => fmtDate(o.date) },
    { key: 'total', head: (t) => t.columns.total, show: 'lg', align: 'right', cell: (o: Order) => fmtEur(o.totalEur) },
    { key: 'status', head: (t) => t.columns.status, cell: (o: Order, c) => <StatusChip tone={TONES.order[o.status]}>{c.tx.enums.orderStatus[o.status]}</StatusChip> },
  ] satisfies Column<Order>[],
  products: [
    id<Product>(),
    { key: 'model', head: (t) => t.columns.model, grow: true, cell: (p: Product, c) => <Two main={p.model} sub={c.tx.enums.category[p.category]} /> },
    { key: 'price', head: (t) => t.columns.price, show: 'md', align: 'right', cell: (p: Product) => fmtEur(p.priceEur) },
    {
      key: 'production',
      head: (t) => t.columns.production,
      show: 'md',
      cell: (p: Product, c) => (p.inProduction ? <span className="text-[12px]">{c.tx.filters.current}</span> : <StatusChip tone="stone">{c.tx.filters.discontinued}</StatusChip>),
    },
  ] satisfies Column<Product>[],
  warranties: [
    id<Warranty>(),
    { key: 'product', head: (t) => t.columns.product, grow: true, cell: (w: Warranty, c) => <Two main={model(c, w.productId)} sub={w.serialNumber} mono /> },
    { key: 'ends', head: (t) => t.columns.ends, show: 'md', cell: (w: Warranty) => fmtDate(w.endDate) },
    { key: 'customer', head: (t) => t.columns.customer, show: 'lg', cell: (w: Warranty, c) => cname(c, w.customerId) },
    {
      key: 'status',
      head: (t) => t.columns.status,
      cell: (w: Warranty, c) => {
        const st = warrantyStatus(w).status
        return <StatusChip tone={TONES.warranty[st]}>{c.tx.enums.warrantyStatus[st]}</StatusChip>
      },
    },
  ] satisfies Column<Warranty>[],
  shipments: shipmentCols(true, false),
  returns: shipmentCols(false, false),
  parts: shipmentCols(false, true),
  profiles: [
    id<ProfileRow>(),
    { key: 'name', head: (t) => t.columns.name, grow: true, cell: (p: ProfileRow, c) => <Two main={p.customer.name} sub={p.customer.notes[c.lang]} />, title: (p: ProfileRow, c) => p.customer.notes[c.lang] },
    { key: 'interactions', head: (t) => t.columns.interactions, show: 'md', align: 'right', cell: (p: ProfileRow) => p.interactions },
    { key: 'lastContact', head: (t) => t.columns.lastContact, show: 'lg', cell: (p: ProfileRow) => fmtDate(p.lastContact) },
    { key: 'openCases', head: (t) => t.columns.openCases, align: 'right', cell: (p: ProfileRow) => (p.openCases ? <StatusChip tone="warn">{p.openCases}</StatusChip> : <span className="text-muted-foreground">0</span>) },
  ] satisfies Column<ProfileRow>[],
  interactions: interactionCols(true),
  complaints: interactionCols(false),
  cases: [
    id<ServiceCase>(),
    {
      key: 'fault',
      head: (t) => t.columns.fault,
      grow: true,
      cell: (k: ServiceCase, c) => <Two main={k.fault[c.lang]} sub={`${cname(c, k.customerId)} · ${short(model(c, k.productId))}${k.errorCode ? ` · ${k.errorCode}` : ''}`} />,
      title: (k: ServiceCase, c) => k.fault[c.lang],
    },
    { key: 'opened', head: (t) => t.columns.opened, show: 'md', cell: (k: ServiceCase) => fmtDate(k.openedDate) },
    { key: 'status', head: (t) => t.columns.status, cell: (k: ServiceCase, c) => <StatusChip tone={TONES.case[k.status]}>{c.tx.enums.caseStatus[k.status]}</StatusChip> },
  ] satisfies Column<ServiceCase>[],
  tickets: [
    id<Ticket>(),
    {
      key: 'issue',
      head: (t) => t.columns.issue,
      grow: true,
      cell: (k: Ticket, c) => <Two main={k.issueDescription} sub={`${cname(c, k.customerId)} · ${short(model(c, k.productId))}`} />,
      title: (k: Ticket) => k.issueDescription,
    },
    { key: 'created', head: (t) => t.columns.created, show: 'md', cell: (k: Ticket) => fmtDate(k.createdDate) },
    { key: 'priority', head: (t) => t.columns.priority, cell: (k: Ticket, c) => <StatusChip tone={TONES.priority[k.priority]}>{c.tx.enums.priority[k.priority]}</StatusChip> },
  ] satisfies Column<Ticket>[],
  documents: [
    {
      key: 'title',
      head: (t) => t.columns.title,
      grow: true,
      cell: (d: KbDocument) => <Two main={d.title} sub={d.id} mono />,
      title: (d: KbDocument) => d.title,
    },
    {
      key: 'appliesTo',
      head: (t) => t.columns.appliesTo,
      show: 'lg',
      cell: (d: KbDocument, c) => <span className="block max-w-56 truncate">{d.appliesTo.length ? d.appliesTo.map(short).join(', ') : c.tx.doc.allProducts}</span>,
    },
    { key: 'effective', head: (t) => t.columns.effective, show: 'md', cell: (d: KbDocument) => fmtDate(d.effectiveDate) },
    { key: 'status', head: (t) => t.columns.status, cell: (d: KbDocument, c) => <StatusChip tone={TONES.docStatus[d.status]}>{c.tx.enums.docStatus[d.status]}</StatusChip> },
  ] satisfies Column<KbDocument>[],
}
