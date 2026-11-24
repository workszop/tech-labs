/** Small building blocks of the explorer and the record dialog: formatting, status chips, record chips, the active-customer mark. */
import * as React from 'react'
import { useMemo } from 'react'
import { FileText, MessagesSquare, Package, Receipt, ShieldCheck, Ticket, Truck, User, UserRoundCheck, Wrench, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { cn, currentLocale } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { kbDocuments } from '@/data/kb'
import type { Customer, Interaction, Order, Product, ServiceCase, Shipment, Ticket as TicketRow, Warranty } from '@/data/company/types'
import { useTable } from '@/sim/db'
import { customerName, productModel, shortModel, type ExplorerData } from './model'
import { pushRecord, type RecordKind, type RecordRef } from './recordNav'

// ---------------------------------------------------------------- formatting (active language)

/** `2026-11-24` -> "24 lis 2026" / "Nov 24, 2026". The date is a calendar date, so it is formatted in UTC. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(t)) return iso
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t)
}
/** `2026-11-14T09:30` -> "14 lis 2026, 09:30" / "Nov 14, 2026, 9:30 AM" (wall-clock time of the record, no time zone shift). */
export function fmtDateTime(iso: string): string {
  const t = Date.parse(`${iso}:00Z`)
  if (Number.isNaN(t)) return iso
  return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(t)
}
export function fmtEur(n: number): string {
  return new Intl.NumberFormat(currentLocale(), { style: 'currency', currency: 'EUR' }).format(n)
}

// ---------------------------------------------------------------- live data

/** Every company table, live from IndexedDB, plus the knowledge documents of the active language. */
export function useExplorerData(): { data: ExplorerData; loaded: boolean } {
  const lang = useLang()
  const customers = useTable<Customer>('customers')
  const products = useTable<Product>('products')
  const orders = useTable<Order>('orders')
  const warranties = useTable<Warranty>('warranties')
  const shipments = useTable<Shipment>('shipments')
  const cases = useTable<ServiceCase>('cases')
  const interactions = useTable<Interaction>('interactions')
  const tickets = useTable<TicketRow>('tickets')
  const docs = useMemo(() => kbDocuments(lang), [lang])
  const data = useMemo(
    () => ({ customers, products, orders, warranties, shipments, cases, interactions, tickets, docs }),
    [customers, products, orders, warranties, shipments, cases, interactions, tickets, docs],
  )
  return { data, loaded: customers.length > 0 && products.length > 0 }
}

// ---------------------------------------------------------------- chips

export type ChipTone = 'ok' | 'warn' | 'danger' | 'stone' | 'doc' | 'ink'
const VARIANT: Record<ChipTone, 'ok' | 'warn' | 'danger' | 'default' | 'doc' | 'solid'> = { ok: 'ok', warn: 'warn', danger: 'danger', stone: 'default', doc: 'doc', ink: 'solid' }

/** Status as a solid chip: success green, pending yellow, error red, inactive stone. */
export function StatusChip({ tone, children, className }: { tone: ChipTone; children: React.ReactNode; className?: string }) {
  return <Badge variant={VARIANT[tone]} className={className}>{children}</Badge>
}

export const TONES = {
  order: { delivered: 'ok', in_transit: 'warn', awaiting_pickup: 'warn', returned: 'stone', cancelled: 'stone' },
  shipment: { delivered: 'ok', in_transit: 'warn', delayed: 'danger', awaiting_pickup: 'warn', returned: 'stone' },
  case: { open: 'warn', waiting_for_part: 'warn', in_repair: 'warn', escalated: 'danger', resolved: 'ok' },
  warranty: { active: 'ok', expired: 'stone', void: 'danger' },
  priority: { urgent: 'danger', high: 'warn', normal: 'stone', low: 'stone' },
  docStatus: { current: 'ok', superseded: 'warn' },
} satisfies Record<string, Record<string, ChipTone>>

export const KIND_ICON: Record<RecordKind, LucideIcon> = {
  customer: User,
  order: Receipt,
  product: Package,
  warranty: ShieldCheck,
  shipment: Truck,
  case: Wrench,
  interaction: MessagesSquare,
  ticket: Ticket,
  document: FileText,
}

/** A linked record as a solid blue chip (company systems colour); opens it in the dialog. */
export function RecordChip({ refTo, label, className }: { refTo: RecordRef; label?: string; className?: string }) {
  const tx = useT().systems.record
  const Icon = KIND_ICON[refTo.kind]
  return (
    <button
      type="button"
      onClick={() => pushRecord(refTo)}
      className={cn('inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-doc px-2 py-0.5 font-mono text-[11px] font-medium leading-5 text-[var(--blue-ink)] transition-colors hover:bg-[var(--doc-text)] [&_svg]:size-3 [&_svg]:shrink-0', className)}
      aria-label={`${tx.kinds[refTo.kind]} ${refTo.id}${label ? ` (${label})` : ''}`}
      data-record-chip={refTo.id}
    >
      <Icon aria-hidden="true" />
      <span className="truncate">{refTo.id}</span>
      {label && <span className="truncate font-sans font-normal opacity-90">· {label}</span>}
    </button>
  )
}

/** Inline ID inside a field value that opens the record. */
export function RecordLink({ refTo, children }: { refTo: RecordRef; children?: React.ReactNode }) {
  const tx = useT().systems.record
  return (
    <button type="button" onClick={() => pushRecord(refTo)} className="cursor-pointer rounded-[var(--r-xs)] font-mono text-[12.5px] text-doc underline decoration-[var(--line-strong)] underline-offset-2 hover:decoration-current" aria-label={tx.open(refTo.id)}>
      {children ?? refTo.id}
    </button>
  )
}

/** Marks a record of the customer signed in to the chat: an ink badge with a yellow person-check icon. */
export function ActiveMark({ className }: { className?: string }) {
  const tx = useT().systems.chatIdentity
  return (
    <Tooltip content={tx.marker}>
      <span className={cn('inline-grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-foreground text-[var(--yellow)]', className)} data-active-mark>
        <UserRoundCheck className="size-3" aria-hidden="true" />
        <span className="sr-only">{tx.marker}</span>
      </span>
    </Tooltip>
  )
}

/** Mono functional label (field names, card head strips). */
export function MonoLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground', className)}>{children}</span>
}

// ---------------------------------------------------------------- linked records

/** The "Linked records" box of the record dialog: one chip per linked record. */
export function Links({ refs, data }: { refs: RecordRef[]; data: ExplorerData }) {
  const tx = useT().systems.record
  return (
    <section aria-label={tx.linked} className="rounded-lg border border-hairline">
      <h3 className="border-b border-hairline bg-subtle px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">
        {tx.linked} <span className="text-muted-foreground">· {refs.length}</span>
      </h3>
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5" data-testid="record-links">
        {refs.length === 0 ? <span className="text-[13px] text-muted-foreground">{tx.noLinks}</span> : refs.map((r) => <RecordChip key={`${r.kind}:${r.id}`} refTo={r} label={chipLabel(r, data)} />)}
      </div>
    </section>
  )
}

function chipLabel(r: RecordRef, data: ExplorerData): string | undefined {
  if (r.kind === 'customer') return customerName(data, r.id) ?? undefined
  if (r.kind === 'product') {
    const m = productModel(data, r.id)
    return m ? shortModel(m) : undefined
  }
  if (r.kind === 'document') return data.docs.find((d) => d.id === r.id)?.title
  return undefined
}
