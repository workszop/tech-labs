/** The support widget's head: Northstar mark, agent avatar and status, the signed-in customer and the scenario picker. */
import { useId, useState } from 'react'
import { Bot, ListChecks, Star, UserRoundCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Customer } from '@/data/company/types'
import type { Scenario } from '@/data/scenarios'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { useSwitchCustomer } from '@/features/systems/ChatIdentity'
import { useStore } from '@/state/store'
import { IconBadge } from '../common'
import { ScenarioList } from './Scenarios'
import { InfoTip } from '../learn/InfoTip'

export type AgentStatus = 'online' | 'working' | 'waiting' | 'offline'

const DOT: Record<AgentStatus, string> = {
  online: 'bg-ok',
  working: 'bg-primary',
  waiting: 'bg-primary',
  offline: 'bg-[var(--ink-3)]',
}

export function ChatHeader({ status, customers, onPickScenario }: { status: AgentStatus; customers: Customer[]; onPickScenario: (s: Scenario) => void }) {
  const tx = useT().chat
  const [open, setOpen] = useState(false)
  return (
    <div className="shrink-0 border-b border-hairline">
      <div className="flex items-center gap-2.5 bg-foreground px-3 py-2.5 text-background">
        <span aria-hidden="true" className="inline-grid size-[34px] shrink-0 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-[18px]">
          <Star fill="currentColor" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold leading-tight text-background">{tx.widget.company}</div>
          <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--yellow)]">{tx.widget.title}</div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="open-scenarios">
          <ListChecks /> {tx.widget.scenarios}
        </Button>
      </div>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-subtle px-3 py-2">
        <span className="relative shrink-0">
          <IconBadge tone="query"><Bot /></IconBadge>
          <span aria-hidden="true" className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--paper-2)]', DOT[status])} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold leading-tight">
            {tx.widget.agentName} <span className="ml-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{tx.widget.agentRole}</span>
          </div>
          <div className="truncate text-[12px] text-[var(--ink-2)]" data-testid="agent-status" data-status={status}>{tx.widget.status[status]}</div>
        </div>
      </div>
      <Identity customers={customers} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{tx.scenarios.title}</DialogTitle>
            <DialogDescription>{tx.scenarios.intro} {tx.scenarios.newConversation}</DialogDescription>
          </DialogHeader>
          <DialogBody className="@container">
            <ScenarioList
              customers={customers}
              onPick={(s) => {
                setOpen(false)
                onPickScenario(s)
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** "Signed in as Emma Wilson, CUST-1042": switching asks first when a conversation exists (it starts a new one). */
function Identity({ customers }: { customers: Customer[] }) {
  const tx = useT().chat.identity
  const activeId = useStore((s) => s.activeCustomerId)
  const { request, dialog } = useSwitchCustomer()
  const selectId = useId()
  const hintId = useId()
  const list = customers.length ? customers : [{ id: activeId, name: activeId } as Customer]
  return (
    <div className="bg-card px-3 py-2" data-testid="chat-identity-bar">
      <div className="flex items-center gap-2">
        <UserRoundCheck className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        <label htmlFor={selectId} className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.label}</label>
        <select
          id={selectId}
          value={activeId}
          onChange={(e) => {
            const c = customers.find((x) => x.id === e.target.value)
            if (c) request(c)
          }}
          aria-describedby={hintId}
          className="h-8 min-w-0 flex-1 cursor-pointer truncate rounded-md border border-input bg-card px-2 text-[13px] font-semibold text-foreground"
          data-testid="chat-customer-select"
        >
          {list.map((c) => (
            <option key={c.id} value={c.id}>{c.name}, {c.id}</option>
          ))}
        </select>
        <InfoTip tip="identity" />
      </div>
      <p id={hintId} className="mt-1 text-[12px] leading-snug text-[var(--ink-2)]">{tx.hint}</p>
      {dialog}
    </div>
  )
}
