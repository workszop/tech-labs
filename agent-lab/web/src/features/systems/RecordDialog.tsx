/**
 * The single record dialog of the app (mounted once in App.tsx). It shows the
 * record on top of the `recordNav` stack: every field, the linked records as
 * clickable chips, and for a knowledge document its text and chunks.
 */
import * as React from 'react'
import { SIM_TODAY } from '@shared/sim'
import { ArrowLeft, SearchX, UserRoundCheck } from 'lucide-react'
import type { Customer, Interaction, Order, Product, ServiceCase, Shipment, Ticket, Warranty } from '@/data/company/types'
import type { KbDocument } from '@/data/kb/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { warrantyStatus } from '@/sim/tools'
import { useStore } from '@/state/store'
import { EmptyState, IconBadge } from '../common'
import { useSwitchCustomer } from './ChatIdentity'
import { DocumentView } from './DocumentView'
import { customerName, findRecord, linksOf, ownerOf, productModel, type ExplorerData } from './model'
import { backRecord, closeRecord, useRecordStack, type RecordKind, type RecordRef } from './recordNav'
import { ActiveMark, KIND_ICON, Links, MonoLabel, RecordLink, StatusChip, TONES, fmtDate, fmtDateTime, fmtEur, useExplorerData } from './ui'

type Tx = ReturnType<typeof useT>['systems']

export function RecordDialogHost() {
  const stack = useRecordStack()
  const top = stack.at(-1)
  if (!top) return null
  return <RecordDialog current={top} previous={stack.at(-2) ?? null} />
}

function RecordDialog({ current, previous }: { current: RecordRef; previous: RecordRef | null }) {
  const tx = useT().systems
  const { data, loaded } = useExplorerData()
  const activeCustomerId = useStore((s) => s.activeCustomerId)
  const record = loaded ? findRecord(current, data) : null
  const Icon = KIND_ICON[current.kind]
  const mine = ownerOf(current, data) === activeCustomerId
  const title = record ? titleOf(current.kind, record) : current.id

  return (
    <Dialog open onOpenChange={(o) => !o && closeRecord()}>
      <DialogContent wide className="max-w-3xl" {...(current.kind === 'document' && record ? {} : { 'aria-describedby': undefined })} data-testid="record-dialog" data-record={current.id}>
        <DialogHeader className="gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {previous && (
              <Button variant="outline" size="xs" onClick={backRecord} aria-label={tx.record.backTo(previous.id)} data-testid="record-back">
                <ArrowLeft /> <span className="font-mono">{previous.id}</span>
              </Button>
            )}
            <MonoLabel className="flex items-center gap-1.5">
              <IconBadge tone="doc" size="sm" className="size-6 [&_svg]:size-3.5"><Icon /></IconBadge>
              {tx.record.kinds[current.kind]}
            </MonoLabel>
            {mine && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground py-0.5 pl-1 pr-2 font-mono text-[11px] text-background">
                <UserRoundCheck aria-hidden="true" className="size-3.5 text-[var(--yellow)]" /> {tx.chatIdentity.inChat}
              </span>
            )}
          </div>
          <DialogTitle className="text-[20px]" data-testid="record-title">
            {current.kind !== 'document' && <span className="mr-2 font-mono text-[16px] font-semibold">{current.id}</span>}
            {title !== current.id && title}
          </DialogTitle>
          {current.kind === 'document' && record ? <DialogDescription className="font-mono text-[11.5px]">{current.id}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!loaded ? null : !record ? (
            <EmptyState icon={<SearchX />} tone="stone" title={tx.record.notFound}>{tx.record.notFoundBody(current.id)}</EmptyState>
          ) : current.kind === 'document' ? (
            <DocumentView doc={record as KbDocument} links={linksOf(current, data)} />
          ) : (
            <>
              <RecordFields kind={current.kind} record={record} data={data} />
              <Links refs={linksOf(current, data)} data={data} />
            </>
          )}
        </DialogBody>
        {record !== null && current.kind === 'customer' && <CustomerFoot customer={record as Customer} />}
      </DialogContent>
    </Dialog>
  )
}

function titleOf(kind: RecordKind, r: unknown): string {
  switch (kind) {
    case 'customer':
      return (r as Customer).name
    case 'product':
      return (r as Product).model
    case 'document':
      return (r as KbDocument).title
    default:
      return (r as { id: string }).id
  }
}

function CustomerFoot({ customer }: { customer: Customer }) {
  const tx = useT().systems.chatIdentity
  const activeId = useStore((s) => s.activeCustomerId)
  const { request, dialog } = useSwitchCustomer()
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-dashed px-5 py-3">
      {activeId === customer.id ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold"><ActiveMark /> {tx.signedIn}</span>
      ) : (
        <Button onClick={() => request(customer)} data-testid="sign-in-as">
          <UserRoundCheck /> {tx.signIn}
        </Button>
      )}
      {dialog}
    </div>
  )
}

// ---------------------------------------------------------------- fields

type Row = [label: string, value: React.ReactNode, wide?: boolean]

function Fields({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
      {rows.map(([label, value, wide]) => (
        <div key={label} className={cn('min-w-0', wide && 'col-span-2')}>
          <dt><MonoLabel>{label}</MonoLabel></dt>
          <dd className="mt-0.5 break-words text-[14px] leading-snug text-foreground">{value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

const mono = (s: string | null | undefined) => (s ? <span className="font-mono text-[13px]">{s}</span> : '-')

function RecordFields({ kind, record, data }: { kind: RecordKind; record: unknown; data: ExplorerData }) {
  const tx = useT().systems
  const lang = useLang()
  const f = tx.record.fields
  const e = tx.enums
  const cust = (id: string) => (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <RecordLink refTo={{ kind: 'customer', id }} /> {customerName(data, id)}
    </span>
  )
  const prod = (id: string) => (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <RecordLink refTo={{ kind: 'product', id }} /> {productModel(data, id)}
    </span>
  )
  const link = (kind: RecordKind, id: string | null | undefined) => (id ? <RecordLink refTo={{ kind, id }} /> : '-')

  switch (kind) {
    case 'customer': {
      const c = record as Customer
      return (
        <Fields
          rows={[
            [f.name, c.name],
            [f.segment, e.segment[c.segment]],
            [f.email, c.email],
            [f.phone, c.phone],
            [f.address, `${c.address.street}, ${c.address.postalCode} ${c.address.city}, ${c.address.country}`, true],
            [f.preferredLanguage, e.language[c.preferredLanguage]],
            [f.customerSince, fmtDate(c.customerSince)],
            [f.notes, c.notes[lang], true],
          ]}
        />
      )
    }
    case 'order': {
      const o = record as Order
      return (
        <>
          <Fields
            rows={[
              [f.customer, cust(o.customerId)],
              [f.date, fmtDate(o.date)],
              [f.status, <StatusChip tone={TONES.order[o.status]}>{e.orderStatus[o.status]}</StatusChip>],
              [f.channel, e.orderChannel[o.channel]],
              [f.total, fmtEur(o.totalEur)],
            ]}
          />
          <OrderLines order={o} data={data} tx={tx} />
        </>
      )
    }
    case 'product': {
      const p = record as Product
      return (
        <Fields
          rows={[
            [f.model, p.model],
            [f.category, e.category[p.category]],
            [f.kind, e.productKind[p.kind]],
            [f.serialPrefix, mono(p.serialPrefix)],
            [f.warrantyMonths, tx.record.months(p.warrantyMonths)],
            [f.priceEur, fmtEur(p.priceEur)],
            [f.launchYear, String(p.launchYear)],
            [f.production, p.inProduction ? tx.filters.current : `${tx.filters.discontinued}${p.discontinued ? ` (${fmtDate(p.discontinued)})` : ''}`],
            [f.description, p.description[lang], true],
          ]}
        />
      )
    }
    case 'warranty': {
      const w = record as Warranty
      const st = warrantyStatus(w)
      return (
        <Fields
          rows={[
            [f.status, <StatusChip tone={TONES.warranty[st.status]}>{e.warrantyStatus[st.status]}</StatusChip>],
            [f.daysRemaining, st.status === 'active' ? tx.record.days(st.daysRemaining) : '-'],
            [f.serialNumber, mono(w.serialNumber)],
            [f.product, prod(w.productId)],
            [f.customer, cust(w.customerId)],
            [f.order, link('order', w.orderId)],
            [f.startDate, fmtDate(w.startDate)],
            [f.endDate, `${fmtDate(w.endDate)} (${tx.record.months(w.months)})`],
            ...(w.transfer ? ([[f.transfer, tx.record.transferFrom(w.transfer.fromCustomerId, fmtDate(w.transfer.date)), true]] as Row[]) : []),
            ...(w.voided ? ([[f.voided, tx.record.voidedOn(fmtDate(w.voided.date), w.voided.reason[lang]), true]] as Row[]) : []),
          ]}
        />
      )
    }
    case 'shipment': {
      const s = record as Shipment
      return (
        <>
          <Fields
            rows={[
              [f.status, <StatusChip tone={TONES.shipment[s.status]}>{e.shipmentStatus[s.status]}</StatusChip>],
              [f.type, e.shipmentType[s.type]],
              [f.contents, s.contents[lang], true],
              [f.customer, cust(s.customerId)],
              [s.caseId ? f.case : f.order, s.caseId ? link('case', s.caseId) : link('order', s.orderId)],
              [f.carrier, s.carrier],
              [f.trackingNumber, mono(s.trackingNumber)],
              [f.from, s.from],
              [f.to, s.to],
              [f.shippedDate, fmtDate(s.shippedDate)],
              [s.deliveredDate ? f.deliveredDate : f.estimatedDelivery, fmtDate(s.deliveredDate ?? s.estimatedDelivery)],
            ]}
          />
          <Timeline
            title={tx.record.events}
            items={[...s.events].reverse().map((ev) => ({
              key: ev.at + ev.code,
              when: fmtDateTime(ev.at),
              tone: ev.code === 'delivered' ? 'ok' : ev.code === 'delayed' || ev.code === 'not_collected' || ev.code === 'returned_to_sender' ? 'danger' : 'ink',
              title: e.eventCode[ev.code] ?? ev.code,
              meta: ev.location,
              text: ev.description[lang],
            }))}
          />
        </>
      )
    }
    case 'case': {
      const k = record as ServiceCase
      const passed = k.promisedDate && k.status !== 'resolved' && k.promisedDate < SIM_TODAY
      return (
        <>
          <Fields
            rows={[
              [f.status, <StatusChip tone={TONES.case[k.status]}>{e.caseStatus[k.status]}</StatusChip>],
              [f.errorCode, mono(k.errorCode)],
              [f.fault, k.fault[lang], true],
              [f.customer, cust(k.customerId)],
              [f.product, prod(k.productId)],
              [f.serialNumber, mono(k.serialNumber)],
              [f.warranty, link('warranty', k.warrantyId)],
              [f.coveredByWarranty, k.coveredByWarranty ? tx.record.yes : tx.record.no],
              [f.openedDate, fmtDate(k.openedDate)],
              [
                f.promisedDate,
                k.promisedDate ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {fmtDate(k.promisedDate)} {passed && <StatusChip tone="danger">{tx.record.promisedPassed}</StatusChip>}
                  </span>
                ) : (
                  '-'
                ),
              ],
              [f.resolvedDate, fmtDate(k.resolvedDate)],
              ...(k.resolution ? ([[f.resolution, k.resolution[lang], true]] as Row[]) : []),
            ]}
          />
          <Timeline title={tx.record.history} items={[...k.history].reverse().map((h, i) => ({ key: h.date + i, when: fmtDate(h.date), tone: 'ink', text: h.note[lang] }))} />
        </>
      )
    }
    case 'interaction': {
      const i = record as Interaction
      return (
        <Fields
          rows={[
            [f.date, fmtDate(i.date)],
            [f.type, i.type === 'complaint' ? <StatusChip tone="danger">{e.interactionType[i.type]}</StatusChip> : e.interactionType[i.type]],
            [f.channel, e.channel[i.channel]],
            [f.handledBy, i.handledBy],
            [f.customer, cust(i.customerId)],
            [i.caseId ? f.case : f.order, i.caseId ? link('case', i.caseId) : link('order', i.orderId)],
            [f.subject, i.subject[lang], true],
            [f.summary, i.summary[lang], true],
            [f.outcome, i.outcome[lang], true],
          ]}
        />
      )
    }
    case 'ticket': {
      const t = record as Ticket
      return (
        <Fields
          rows={[
            [f.status, <StatusChip tone="warn">{e.ticketStatus[t.status] ?? t.status}</StatusChip>],
            [f.priority, <StatusChip tone={TONES.priority[t.priority]}>{e.priority[t.priority]}</StatusChip>],
            [f.customer, cust(t.customerId)],
            [f.product, prod(t.productId)],
            [f.createdDate, fmtDate(t.createdDate)],
            [f.createdBy, <span className="inline-flex items-center gap-1.5"><StatusChip tone="stone">{tx.record.agent}</StatusChip></span>],
            [f.issueDescription, <span className="whitespace-pre-wrap">{t.issueDescription}</span>, true],
          ]}
        />
      )
    }
    default:
      return null
  }
}

function OrderLines({ order, data, tx }: { order: Order; data: ExplorerData; tx: Tx }) {
  const f = tx.record.fields
  return (
    <section className="overflow-hidden rounded-lg border border-hairline">
      <h3 className="border-b border-hairline bg-subtle px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{tx.record.lines}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-muted text-left font-mono text-[10.5px] uppercase tracking-[0.08em]">
              <th className="px-3 py-1.5 font-medium">{f.product}</th>
              <th className="px-3 py-1.5 font-medium">{f.serialNumber}</th>
              <th className="px-3 py-1.5 font-medium">{f.warranty}</th>
              <th className="px-3 py-1.5 text-right font-medium">{tx.record.lineQty}</th>
              <th className="px-3 py-1.5 text-right font-medium">{tx.record.lineUnit}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => (
              <tr key={i} className={cn('border-t border-hairline', i % 2 === 1 && 'bg-subtle')}>
                <td className="px-3 py-1.5">
                  <RecordLink refTo={{ kind: 'product', id: l.productId }} /> <span className="text-foreground">{productModel(data, l.productId)}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px]">{l.serialNumber ?? '-'}</td>
                <td className="whitespace-nowrap px-3 py-1.5">{l.warrantyId ? <RecordLink refTo={{ kind: 'warranty', id: l.warrantyId }} /> : '-'}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.quantity}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{fmtEur(l.unitPriceEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Dated events, newest first: a dot per event (green delivered, red problem, ink otherwise) on a neutral rail. */
function Timeline({ title, items }: { title: string; items: { key: string; when: string; tone: 'ok' | 'danger' | 'ink'; title?: string; meta?: string; text: string }[] }) {
  if (!items.length) return null
  const dot = { ok: 'bg-ok', danger: 'bg-danger', ink: 'bg-card border-2 border-foreground' }
  return (
    <section className="rounded-lg border border-hairline">
      <h3 className="border-b border-hairline bg-subtle px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{title}</h3>
      <ol className="px-3 py-2.5" data-testid="record-timeline">
        {items.map((it, i) => (
          <li key={it.key} className="relative flex gap-3 pb-3 last:pb-0">
            {i < items.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-border" />}
            <span aria-hidden="true" className={cn('relative mt-1 size-[11px] shrink-0 rounded-full', dot[it.tone])} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[11.5px] text-[var(--ink-2)]">{it.when}</span>
                {it.title && <span className="text-[13px] font-semibold">{it.title}</span>}
                {it.meta && <span className="text-[12px] text-muted-foreground">{it.meta}</span>}
              </div>
              <p className="text-[13px] leading-snug text-[var(--ink-2)]">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
