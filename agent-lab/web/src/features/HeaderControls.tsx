/** Header pieces of the app frame: simulation date, knowledge base status, reset menu and log out. */
import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Database, Loader2, LogOut, MessageSquarePlus, RotateCcw } from 'lucide-react'
import { SIM_TODAY } from '@shared/sim'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { logout, resetEverything, startNewConversation } from '@/state/actions'
import { useStore } from '@/state/store'
import { fmtDate } from './systems/ui'

/** Two-line header stat: mono label above a short value. */
const HeaderStat = forwardRef<HTMLDivElement, { icon: React.ReactNode; label: string; value: React.ReactNode; testId?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>>(
  ({ icon, label, value, className, testId, ...rest }, ref) => (
    <div ref={ref} tabIndex={0} {...rest} className={cn('items-center gap-2 rounded-lg px-2 py-1 [&_svg]:size-4 [&_svg]:shrink-0', className)} data-testid={testId}>
      {icon}
      <div className="min-w-0 leading-tight">
        <div className="whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <div className="whitespace-nowrap text-[12.5px] font-semibold text-foreground">{value}</div>
      </div>
    </div>
  ),
)
HeaderStat.displayName = 'HeaderStat'

export function SimDate() {
  const tx = useT().shell.header
  return (
    <Tooltip content={tx.simDateTooltip}>
      <HeaderStat className="hidden md:flex" icon={<CalendarDays aria-hidden="true" />} label={tx.simDate} value={fmtDate(SIM_TODAY)} testId="sim-date" />
    </Tooltip>
  )
}

export function KbStatus() {
  const kb = useStore((s) => s.kbIndex)
  const tx = useT().shell.header.kb
  const value = kb.status === 'indexing' ? tx.indexing(kb.done, kb.total) : tx[kb.status]
  const icon =
    kb.status === 'ready' ? <CheckCircle2 aria-hidden="true" className="text-ok" /> : kb.status === 'error' ? <AlertTriangle aria-hidden="true" className="text-danger" /> : kb.status === 'idle' ? <Database aria-hidden="true" className="text-muted-foreground" /> : <Loader2 aria-hidden="true" className="animate-spin text-foreground" />
  return (
    <Tooltip content={kb.status === 'error' && kb.error ? `${tx.tooltip} ${kb.error}` : tx.tooltip}>
      <HeaderStat className="hidden lg:flex" icon={icon} label={tx.label} value={value} testId="kb-status" />
    </Tooltip>
  )
}

/** Reset menu: new conversation or reset everything; both ask for confirmation in a dialog. */
export function ResetMenu() {
  const tx = useT().shell.reset
  const hasConversation = useStore((s) => s.conversation.length > 0 || s.currentRun !== null)
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'new' | 'all' | null>(null)
  const [busy, setBusy] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const items = () => Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])
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

  const choose = (what: 'new' | 'all') => {
    setOpen(false)
    if (what === 'new' && !hasConversation) startNewConversation()
    else setConfirm(what)
  }
  const run = async () => {
    setBusy(true)
    try {
      if (confirm === 'new') startNewConversation()
      else await resetEverything()
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const item = (what: 'new' | 'all', icon: React.ReactNode, title: string, hint: string) => (
    <button role="menuitem" type="button" onClick={() => choose(what)} className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle" data-reset={what}>
      <span aria-hidden="true" className={cn('mt-0.5 inline-grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4', what === 'all' ? 'bg-danger text-[var(--red-ink)]' : 'bg-foreground text-[var(--yellow)]')}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-[12px] leading-snug text-[var(--ink-2)]">{hint}</span>
      </span>
    </button>
  )

  return (
    <div ref={wrap} className="relative">
      <Button ref={button} variant="outline" size="sm" className="px-2.5 sm:px-3" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)} data-testid="reset-menu">
        <RotateCcw /> <span className="hidden sm:inline">{tx.button}</span>
        <ChevronDown className="hidden sm:block" />
      </Button>
      {open && (
        <div id={menuId} role="menu" aria-label={tx.menuLabel} className="fixed inset-x-3 top-[66px] z-50 rounded-xl border bg-card p-1.5 shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[19rem]">
          {item('new', <MessageSquarePlus />, tx.newConversation, tx.newConversationHint)}
          {item('all', <RotateCcw />, tx.resetAll, tx.resetAllHint)}
        </div>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === 'all' ? tx.confirmResetTitle : tx.confirmNewTitle}</DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{confirm === 'all' ? tx.confirmResetBody : tx.confirmNewBody}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2 border-t border-dashed px-5 py-3">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>{tx.cancel}</Button>
            <Button variant={confirm === 'all' ? 'danger' : 'default'} onClick={run} disabled={busy} data-testid="confirm-reset">
              {busy ? <Loader2 className="animate-spin" /> : confirm === 'all' ? <RotateCcw /> : <MessageSquarePlus />}
              {confirm === 'all' ? tx.confirmReset : tx.confirmNew}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function LogoutButton() {
  const tx = useT().shell.header
  return (
    <Tooltip content={tx.logout}>
      <Button variant="ghost" size="sm" className="px-2 hover:bg-muted 2xl:px-3" onClick={() => void logout()} aria-label={tx.logout} data-testid="logout">
        <LogOut /> <span className="hidden 2xl:inline">{tx.logout}</span>
      </Button>
    </Tooltip>
  )
}
