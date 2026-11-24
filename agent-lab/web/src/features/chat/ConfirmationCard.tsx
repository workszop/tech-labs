/**
 * R17: the agent proposes `create_service_ticket` and the customer decides. The
 * card stays in the history with its decision (approved, rejected, cancelled).
 */
import { useEffect, useRef } from 'react'
import { Ban, Check, CircleSlash, DatabaseZap, Hourglass, Ticket, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatItem } from '@/agent/types'
import type { Customer, Product } from '@/data/company/types'
import { useT } from '@/i18n'
import { resolveConfirmation } from '@/state/actions'
import { IconBadge } from '../common'
import { StatusChip } from '@/features/systems/ui'

type Confirmation = Extract<ChatItem, { kind: 'confirmation' }>

const PRIORITY_TONE: Record<string, 'danger' | 'warn' | 'stone'> = { urgent: 'danger', high: 'warn', normal: 'stone', low: 'stone' }

export function ConfirmationCard({ item, live, customers, products, onDecided }: { item: Confirmation; live: boolean; customers: Customer[]; products: Product[]; onDecided: () => void }) {
  const tx = useT().chat.confirmation
  const ref = useRef<HTMLElement>(null)
  const args = item.call.arguments
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : '')
  const customerId = str('customer_id')
  const productId = str('product_id')
  const priority = str('priority')
  const customer = customers.find((c) => c.id === customerId.toUpperCase())
  const product = products.find((p) => p.id === productId.toUpperCase())
  const pending = item.state === 'pending' && live

  // Move the keyboard to the card when it asks for a decision; Tab then reaches Approve and Reject.
  useEffect(() => {
    if (pending) ref.current?.focus({ preventScroll: true })
  }, [pending])

  const decide = (approved: boolean) => {
    resolveConfirmation(approved)
    onDecided()
  }

  const state = item.state === 'pending' && !live ? 'cancelled' : item.state
  const stateChip = {
    pending: <StatusChip tone="warn"><Hourglass /> {tx.state.pending}</StatusChip>,
    approved: <StatusChip tone="ok"><Check /> {tx.state.approved}</StatusChip>,
    rejected: <StatusChip tone="stone"><Ban /> {tx.state.rejected}</StatusChip>,
    cancelled: <StatusChip tone="stone"><CircleSlash /> {tx.state.cancelled}</StatusChip>,
  }[state]

  const rows: [string, React.ReactNode][] = [
    [tx.action, <span className="font-semibold">{tx.actionValue}</span>],
    [tx.customer, <span>{customer?.name ?? customerId} <span className="font-mono text-[11.5px] text-muted-foreground">{customerId}</span></span>],
    [tx.product, <span>{product ? product.model.replace(/^Northstar\s+/, '') : productId} <span className="font-mono text-[11.5px] text-muted-foreground">{productId}</span></span>],
    [tx.issue, <span className="whitespace-pre-wrap">{str('issue_description')}</span>],
    [tx.priority, <StatusChip tone={PRIORITY_TONE[priority] ?? 'stone'}>{tx.priorities[priority] ?? priority}</StatusChip>],
    [tx.expected, tx.expectedValue],
  ]

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={tx.title}
      className="@container overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      data-testid="confirmation-card"
      data-state={state}
    >
      <div className="flex items-start gap-2.5 border-b border-hairline bg-subtle px-3 py-2">
        <IconBadge size="sm" tone="query"><Ticket /></IconBadge>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[14.5px] font-bold leading-snug">{tx.title}</h3>
          {pending && <p className="text-[12px] leading-snug text-[var(--ink-2)]">{tx.lead}</p>}
          <StatusChip tone="danger" className="mt-1"><DatabaseZap /> {tx.changesData}</StatusChip>
        </div>
      </div>
      <dl className="grid grid-cols-[minmax(0,8.5rem)_1fr] gap-x-3 gap-y-1.5 px-3 py-2.5 text-[13px] leading-snug @max-sm:grid-cols-1 @max-sm:gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="pt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{k}</dt>
            <dd className="min-w-0 text-foreground @max-sm:mb-1.5">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-dashed border-border px-3 py-2">
        {pending ? (
          <>
            <Button variant="outline" size="sm" onClick={() => decide(false)} data-testid="confirm-reject">
              <X /> {tx.reject}
            </Button>
            <Button size="sm" onClick={() => decide(true)} data-testid="confirm-approve">
              <Check /> {tx.approve}
            </Button>
          </>
        ) : (
          stateChip
        )}
      </div>
    </section>
  )
}
