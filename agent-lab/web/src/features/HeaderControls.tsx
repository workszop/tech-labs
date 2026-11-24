/** Header pieces of the app frame: simulation date, knowledge base status, reset menu and log out. */
import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { Activity, AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown, Database, Loader2, ListRestart, LogOut, Gauge, MessageSquarePlus, RotateCcw, Trash2 } from 'lucide-react'
import { SIM_TODAY } from '@shared/sim'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { logout, resetEverything, resetScenario, startNewConversation } from '@/state/actions'
import { DEFAULT_CUSTOMER_ID, useStore } from '@/state/store'
import type { Customer, Ticket } from '@/data/company/types'
import { useTable } from '@/sim/db'
import { disabledTools } from './learn/presets'
import { fmtNumber, fmtUsd } from './common'
import { labStatus, quotaOf } from './headerStatus'
import { fmtDate } from './systems/ui'

/** Two-line header stat: mono label above a short value (the full form, shown from xl). */
const HeaderStat = forwardRef<HTMLDivElement, { icon: React.ReactNode; label: string; value: React.ReactNode; testId?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>>(
  ({ icon, label, value, className, testId, ...rest }, ref) => (
    <div ref={ref} {...rest} className={cn('items-center gap-2 rounded-lg px-2 py-1 [&_svg]:size-4 [&_svg]:shrink-0', className)} data-testid={testId}>
      {icon}
      <div className="min-w-0 leading-tight">
        <div className="whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <div className="whitespace-nowrap text-[12.5px] font-semibold text-foreground">{value}</div>
      </div>
    </div>
  ),
)
HeaderStat.displayName = 'HeaderStat'

export function useQuota() {
  return quotaOf(useStore((s) => s.usage))
}

export function useLabStatus(): 'ok' | 'warn' | 'danger' {
  const kb = useStore((s) => s.kbIndex.status)
  const active = useStore((s) => s.auth.status === 'active')
  const usage = useStore((s) => s.usage)
  return labStatus({ kb, active, usage })
}

function KbIcon({ status }: { status: string }) {
  return status === 'ready' ? <CheckCircle2 aria-hidden="true" className="text-ok" /> : status === 'error' ? <AlertTriangle aria-hidden="true" className="text-danger" /> : status === 'idle' ? <Database aria-hidden="true" className="text-muted-foreground" /> : <Loader2 aria-hidden="true" className="animate-spin text-foreground" />
}
function useKbText() {
  const kb = useStore((s) => s.kbIndex)
  const tx = useT().shell.header.kb
  return { kb, value: kb.status === 'indexing' ? tx.indexing(kb.done, kb.total) : tx[kb.status] }
}

export function SimDate() {
  const tx = useT().shell.header
  return (
    <Tooltip content={tx.simDateTooltip}>
      <HeaderStat className="hidden xl:flex" icon={<CalendarDays aria-hidden="true" />} label={tx.simDate} value={fmtDate(SIM_TODAY)} testId="sim-date" />
    </Tooltip>
  )
}

export function KbStatus() {
  const tx = useT().shell.header.kb
  const { kb, value } = useKbText()
  return (
    <Tooltip content={kb.status === 'error' && kb.error ? `${tx.tooltip} ${kb.error}` : tx.tooltip}>
      <HeaderStat className="hidden xl:flex" icon={<KbIcon status={kb.status} />} label={tx.label} value={value} testId="kb-status" />
    </Tooltip>
  )
}

function QuotaBar({ pct }: { pct: number }) {
  return (
    <span className="block h-2 w-20 overflow-hidden rounded-full bg-foreground">
      <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
  )
}

/** Token meter of the access code (full form, from xl). */
export function QuotaMeter() {
  const q = useQuota()
  const tx = useT().shell.header
  if (!q) return null
  return (
    <Tooltip content={tx.usageTooltip({ requestsUsed: fmtNumber(q.usage.requestsUsed), requestLimit: fmtNumber(q.usage.requestLimit), tokensUsed: fmtNumber(q.usage.tokensUsed), tokenLimit: fmtNumber(q.usage.tokenLimit), cost: fmtUsd(q.usage.estimatedCostUsd) })}>
      <div className="hidden items-center gap-2 rounded-full px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ink-2)] xl:flex" data-testid="usage-meter">
        <Gauge className="size-3.5" />
        <QuotaBar pct={q.pct} />
        <span className={cn('tabular-nums', (q.low || q.exhausted) && 'font-medium text-danger')}>{tx.tokensLeft(fmtNumber(q.tokensLeft), Math.round(q.tokensLeft))}</span>
      </div>
    </Tooltip>
  )
}

/** "Offline demo models" badge: full label from xl, short label under the app name below xl. Visible at every width. */
export function DemoBadge({ short }: { short?: boolean }) {
  const provider = useStore((s) => s.auth.session?.capabilities.provider)
  const tx = useT().shell.header
  if (provider !== 'mock') return null
  return (
    <Tooltip content={tx.mockTooltip}>
      <span className={short ? 'inline-flex xl:hidden' : 'hidden xl:inline-flex'} data-testid={short ? 'demo-badge-short' : 'demo-badge'}>
        <Badge variant="warn" className={short ? 'px-1.5 text-[10px] leading-[14px]' : undefined}>{short ? tx.mockBadgeShort : tx.mockBadge}</Badge>
      </span>
    </Tooltip>
  )
}

const DOT = { ok: 'bg-ok', warn: 'bg-primary', danger: 'bg-danger' }

/**
 * Below xl the header has no room for the date, knowledge base and quota stats:
 * one status button with a state dot opens a dialog that lists them (and log out on phones).
 */
export function StatusButton() {
  const tx = useT().shell.header
  const st = tx.status
  const state = useLabStatus()
  const q = useQuota()
  const { kb, value } = useKbText()
  const provider = useStore((s) => s.auth.session?.capabilities.provider)
  const active = useStore((s) => s.auth.status === 'active')
  const [open, setOpen] = useState(false)
  const row = (icon: React.ReactNode, label: string, val: React.ReactNode, extra?: React.ReactNode, testId?: string) => (
    <div className="flex gap-3 border-b border-hairline px-5 py-3 last:border-b-0 [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0" data-testid={testId}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground">{label}</div>
        <div className="text-[14px] font-semibold">{val}</div>
        {extra && <div className="mt-1 text-[12.5px] leading-snug text-[var(--ink-2)]">{extra}</div>}
      </div>
    </div>
  )
  return (
    <>
      <Button variant="outline" size="icon" className="relative size-9 xl:hidden" onClick={() => setOpen(true)} aria-label={`${st.button}: ${st[state]}`} data-testid="status-button" data-state={state}>
        <Activity />
        <span aria-hidden="true" className={cn('absolute right-0.5 top-0.5 size-2.5 rounded-full shadow-[0_0_0_2px_var(--paper)]', DOT[state])} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="status-dialog">
          <DialogHeader>
            <DialogTitle>{st.title}</DialogTitle>
            <DialogDescription>{st[state]}</DialogDescription>
          </DialogHeader>
          <div>
            {row(<CalendarDays aria-hidden="true" />, tx.simDate, fmtDate(SIM_TODAY), tx.simDateTooltip)}
            {row(
              <KbIcon status={kb.status} />,
              tx.kb.label,
              value,
              <>
                {kb.status === 'indexing' && kb.total > 0 && (
                  <span className="mb-1.5 block h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${(kb.done / kb.total) * 100}%` }} /></span>
                )}
                {kb.status === 'error' && kb.error ? kb.error : tx.kb.tooltip}
              </>,
              'status-kb',
            )}
            {provider === 'mock' && row(<AlertTriangle aria-hidden="true" />, st.model, <Badge variant="warn">{tx.mockBadge}</Badge>, tx.mockTooltip, 'status-demo')}
            {q &&
              row(
                <Gauge aria-hidden="true" />,
                st.quota,
                <span className={cn('flex items-center gap-2', (q.low || q.exhausted) && 'text-danger')}><QuotaBar pct={q.pct} /> {tx.tokensLeft(fmtNumber(q.tokensLeft), Math.round(q.tokensLeft))}</span>,
                tx.usageTooltip({ requestsUsed: fmtNumber(q.usage.requestsUsed), requestLimit: fmtNumber(q.usage.requestLimit), tokensUsed: fmtNumber(q.usage.tokensUsed), tokenLimit: fmtNumber(q.usage.tokenLimit), cost: fmtUsd(q.usage.estimatedCostUsd) }),
                'status-quota',
              )}
          </div>
          {active && (
            <div className="flex justify-end border-t border-dashed px-5 py-3 sm:hidden">
              <Button variant="outline" onClick={() => { setOpen(false); void logout() }} data-testid="status-logout"><LogOut /> {tx.logout}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

type ResetChoice = 'new' | 'scenario' | 'all'

/**
 * Reset menu: new conversation, reset this scenario, reset everything (and log
 * out on phones, where the header has no room for it). Each choice that removes
 * something asks first and lists exactly what is removed and what is kept.
 */
export function ResetMenu() {
  const tx = useT().shell
  const r = tx.reset
  const active = useStore((s) => s.auth.status === 'active')
  const conversation = useStore((s) => s.conversation)
  const running = useStore((s) => s.currentRun !== null)
  const runs = useStore((s) => s.runs.length)
  const off = useStore((s) => disabledTools(s.enabledTools).length)
  const customerId = useStore((s) => s.activeCustomerId)
  const customers = useTable<Customer>('customers')
  const tickets = useTable<Ticket>('tickets').length
  const hasConversation = conversation.length > 0 || running
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<ResetChoice | null>(null)
  const [busy, setBusy] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const items = () => Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? []).filter((el) => el.offsetParent !== null)
    items()[0]?.focus()
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      const list = items()
      const i = list.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        button.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus()
      } else if (e.key === 'Tab') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (what: ResetChoice) => {
    setOpen(false)
    if (what === 'new' && !hasConversation) startNewConversation()
    else setConfirm(what)
  }
  const run = async () => {
    setBusy(true)
    try {
      if (confirm === 'new') startNewConversation()
      else if (confirm === 'scenario') await resetScenario()
      else await resetEverything()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? id
  const messages = conversation.filter((i) => i.kind === 'customer' || i.kind === 'agent').length
  const conv = messages > 0 ? [r.items.conversation(messages)] : []
  const lists: Record<ResetChoice, { removed: string[]; kept: string[] }> = {
    new: { removed: [r.items.conversation(messages)], kept: [r.keep.customer(nameOf(customerId)), r.keep.companyData, r.keep.runs(runs), r.keep.switches, r.keep.kb] },
    scenario: { removed: [...conv, r.items.companyData(tickets)], kept: [r.keep.customer(nameOf(customerId)), r.keep.runs(runs), r.keep.switches, r.keep.kb] },
    all: {
      removed: [
        ...conv,
        r.items.companyData(tickets),
        r.items.runs(runs),
        r.items.switches(off),
        ...(customerId !== DEFAULT_CUSTOMER_ID ? [r.items.customer(nameOf(DEFAULT_CUSTOMER_ID))] : []),
      ],
      kept: [r.keep.kb],
    },
  }
  const TITLE = { new: r.confirmNewTitle, scenario: r.confirmScenarioTitle, all: r.confirmResetTitle }
  const ACTION = { new: r.confirmNew, scenario: r.confirmScenario, all: r.confirmReset }
  const ICON = { new: <MessageSquarePlus />, scenario: <ListRestart />, all: <RotateCcw /> }

  const item = (what: ResetChoice, title: string, hint: string) => (
    <button role="menuitem" type="button" onClick={() => choose(what)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle" data-reset={what}>
      <span aria-hidden="true" className={cn('mt-0.5 inline-grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4', what === 'all' ? 'bg-danger text-[var(--red-ink)]' : 'bg-foreground text-[var(--yellow)]')}>{ICON[what]}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-[12px] leading-snug text-[var(--ink-2)]">{hint}</span>
      </span>
    </button>
  )

  const list = (title: string, entries: string[], removed: boolean) => (
    <div>
      <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground">{title}</div>
      <ul className="mt-1 space-y-1" data-testid={removed ? 'reset-removed' : 'reset-kept'}>
        {entries.map((e) => (
          <li key={e} className="flex gap-2 text-[13px] leading-snug">
            {removed ? <Trash2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-danger" /> : <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ok" />}
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div ref={wrap} className="relative">
      <Button ref={button} variant="outline" size="sm" className="px-2.5 sm:px-3" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={r.menuLabel} onClick={() => setOpen(!open)} data-testid="reset-menu">
        <RotateCcw /> <span className="hidden sm:inline">{r.button}</span>
        <ChevronDown className="hidden sm:block" />
      </Button>
      {open && (
        <div id={menuId} role="menu" aria-label={r.menuLabel} className="fixed inset-x-3 top-[66px] z-50 rounded-xl border bg-card p-1.5 shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[20rem]">
          {item('new', r.newConversation, r.newConversationHint)}
          {item('scenario', r.resetScenario, r.resetScenarioHint)}
          {item('all', r.resetAll, r.resetAllHint)}
          {active && (
            <div className="mt-1 border-t border-dashed pt-1 sm:hidden">
              <button role="menuitem" type="button" onClick={() => { setOpen(false); void logout() }} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors hover:bg-subtle focus-visible:bg-subtle" data-testid="menu-logout">
                <span aria-hidden="true" className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-muted text-foreground [&_svg]:size-4"><LogOut /></span>
                {tx.header.logout}
              </button>
            </div>
          )}
        </div>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent data-testid="reset-confirm" data-choice={confirm ?? undefined}>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>{TITLE[confirm]}</DialogTitle>
                <DialogDescription className="sr-only">{lists[confirm].removed.join('. ')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-5 py-4">
                {list(r.removed, lists[confirm].removed, true)}
                {list(r.kept, lists[confirm].kept, false)}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-dashed px-5 py-3">
                <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>{r.cancel}</Button>
                <Button variant={confirm === 'new' ? 'default' : 'danger'} onClick={run} disabled={busy} data-testid="confirm-reset">
                  {busy ? <Loader2 className="animate-spin" /> : ICON[confirm]}
                  {ACTION[confirm]}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function LogoutButton() {
  const tx = useT().shell.header
  return (
    <Tooltip content={tx.logout}>
      <Button variant="ghost" size="sm" className="hidden px-2 hover:bg-muted sm:inline-flex 2xl:px-3" onClick={() => void logout()} aria-label={tx.logout} data-testid="logout">
        <LogOut /> <span className="hidden 2xl:inline">{tx.logout}</span>
      </Button>
    </Tooltip>
  )
}
