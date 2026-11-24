import { useId, useState } from 'react'
import { UserRoundCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Customer } from '@/data/company/types'
import { useT } from '@/i18n'
import { setActiveCustomer } from '@/state/actions'
import { useStore } from '@/state/store'

/**
 * Switches the chat to another customer. A running or non-empty conversation is
 * ended by the switch, so that case asks first.
 */
export function useSwitchCustomer() {
  const busy = useStore((s) => s.conversation.length > 0 || s.currentRun !== null)
  const [pending, setPending] = useState<Customer | null>(null)
  const tx = useT().systems.chatIdentity
  const request = (c: Customer) => {
    if (busy) setPending(c)
    else void setActiveCustomer(c.id)
  }
  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pending ? tx.confirmTitle(pending.name) : ''}</DialogTitle>
          <DialogDescription>{tx.confirmBody}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2 border-t border-dashed px-5 py-3">
          <Button variant="outline" onClick={() => setPending(null)}>{tx.cancel}</Button>
          <Button
            onClick={() => {
              if (pending) void setActiveCustomer(pending.id)
              setPending(null)
            }}
            data-testid="confirm-switch-customer"
          >
            <UserRoundCheck /> {tx.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
  return { request, dialog }
}

/** Banner at the top of the customer view: who is signed in to the chat, and a control to change it. */
export function ChatIdentity({ customers }: { customers: Customer[] }) {
  const tx = useT().systems.chatIdentity
  const activeId = useStore((s) => s.activeCustomerId)
  const { request, dialog } = useSwitchCustomer()
  const hintId = useId()
  return (
    <div className="flex items-center gap-3 border-b border-hairline bg-subtle px-3 py-2.5" data-testid="chat-identity">
      <span aria-hidden="true" className="inline-grid size-[34px] shrink-0 place-items-center rounded-md bg-foreground text-[var(--yellow)]">
        <UserRoundCheck className="size-[18px]" />
      </span>
      <label className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.banner}</span>
        <select
          value={activeId}
          onChange={(e) => {
            const c = customers.find((x) => x.id === e.target.value)
            if (c) request(c)
          }}
          className="mt-1 h-8 w-full min-w-0 cursor-pointer rounded-md border border-input bg-card px-2 text-[13px] font-semibold text-foreground"
          title={tx.hint}
          aria-describedby={hintId}
          data-testid="chat-identity-select"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.id}</option>
          ))}
        </select>
        <span id={hintId} className="sr-only">{tx.hint}</span>
      </label>
      {dialog}
    </div>
  )
}
