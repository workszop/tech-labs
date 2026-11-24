/** Chat bubbles and the parts of an agent reply: tool steps, sources, escalation and run notices. */
import { useEffect, useLayoutEffect, useState } from 'react'
import {
  AlertTriangle, BookText, Bot, Check, ChevronDown, CircleSlash, Contact, FileText, Gauge, Hourglass, LoaderCircle, Package, Receipt, ServerCrash, ShieldCheck, Ticket, Timer, Truck, Wrench, XCircle, type LucideIcon,
} from 'lucide-react'
import type { SystemId } from '@shared/tools'
import type { ChatItem } from '@/agent/types'
import { cn, currentLocale } from '@/lib/utils'
import { useT } from '@/i18n'
import { selectTraceItem } from '@/state/actions'
import { setUi, useStore } from '@/state/store'
import { Markdown } from '@/features/systems/DocumentView'
import { openRecord } from '@/features/systems/recordNav'
import { KIND_ICON } from '@/features/systems/ui'
import { IconBadge } from '../common'
import type { RunView, Source, StepView } from './model'

const SYSTEM_ICON: Record<SystemId, LucideIcon> = {
  orders: Receipt,
  products: Package,
  warranty: ShieldCheck,
  logistics: Truck,
  crm: Contact,
  knowledge: BookText,
  tickets: Wrench,
}

function time(at: number): string {
  return new Intl.DateTimeFormat(currentLocale(), { hour: '2-digit', minute: '2-digit' }).format(at)
}

const AgentAvatar = () => <IconBadge size="sm" tone="query" className="mt-0.5"><Bot /></IconBadge>

/** Agent-side row: grape avatar on the left, content on the right. */
export function AgentRow({ children, className, testId }: { children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <div className={cn('flex items-start gap-2', className)} data-testid={testId}>
      <AgentAvatar />
      <div className="min-w-0 max-w-[36rem] flex-1">{children}</div>
    </div>
  )
}

export function CustomerBubble({ item }: { item: Extract<ChatItem, { kind: 'customer' }> }) {
  const tx = useT().chat.messages
  return (
    <div className="flex flex-col items-end" data-testid="customer-message">
      <div className="max-w-[min(88%,32rem)] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-foreground px-3.5 py-2 text-[14px] leading-relaxed text-background">{item.text}</div>
      <div className="mt-1 pr-1 font-mono text-[10.5px] text-muted-foreground">{tx.you} · {time(item.at)}</div>
    </div>
  )
}

export function AgentBubble({ item, view }: { item: Extract<ChatItem, { kind: 'agent' }>; view: RunView }) {
  const tx = useT().chat
  return (
    <AgentRow testId="agent-message">
      <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground shadow-sm">
        <div className="break-words [&>*:last-child]:mb-0 [&_ol]:mb-2 [&_p]:mb-2 [&_ul]:mb-2">
          <Markdown text={item.text} />
        </div>
        <Escalation view={view} />
        {view.sources.length > 0 && <Sources sources={view.sources} />}
      </div>
      <div className="mt-1 pl-1 font-mono text-[10.5px] text-muted-foreground">{tx.messages.agent} · {time(item.at)}</div>
    </AgentRow>
  )
}

/** Ticket created by the run, or a handover to human support without one (see `handsOver` for the rule). */
export function Escalation({ view, standalone }: { view: RunView; standalone?: boolean }) {
  const tx = useT().chat
  if (!view.ticketId && !view.handover) return null
  const ticket = view.ticketId
  return (
    <div className={cn('flex gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5', standalone ? 'shadow-sm' : 'mt-2.5')} data-testid="escalation" data-kind={ticket ? 'ticket' : 'handover'}>
      <IconBadge size="sm" tone={ticket ? 'ok' : 'warn'}>{ticket ? <Ticket /> : <ServerCrash />}</IconBadge>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <div className="font-display text-[14px] font-bold">{ticket ? tx.escalation.ticketTitle : tx.escalation.handoverTitle}</div>
        <p className="mt-0.5 text-[var(--ink-2)]">{ticket ? tx.escalation.ticketBody : tx.escalation.handoverBody}</p>
        {ticket && <div className="mt-1.5"><SourceChip source={{ kind: 'ticket', id: ticket }} /></div>}
      </div>
    </div>
  )
}

const VISIBLE_SOURCES = 6

function Sources({ sources }: { sources: Source[] }) {
  const tx = useT().chat.sources
  const [all, setAll] = useState(false)
  const shown = all ? sources : sources.slice(0, VISIBLE_SOURCES)
  const hidden = sources.length - shown.length
  return (
    <div className="mt-2.5 border-t border-dashed border-border pt-2" data-testid="sources">
      <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.label}</div>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <li key={`${s.kind}:${s.id}`} className="min-w-0 max-w-full"><SourceChip source={s} /></li>
        ))}
        {(hidden > 0 || all) && sources.length > VISIBLE_SOURCES && (
          <li>
            <button type="button" onClick={() => setAll(!all)} className="h-6 cursor-pointer rounded-full border border-input bg-card px-2 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted">
              {all ? tx.less : tx.more(hidden)}
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}

/** A record or document the run's tools returned, as a solid blue chip (company systems colour). */
function SourceChip({ source }: { source: Source }) {
  const tx = useT()
  const Icon = source.kind === 'document' ? FileText : KIND_ICON[source.kind]
  const doc = source.kind === 'document'
  return (
    <button
      type="button"
      onClick={() => openRecord({ kind: source.kind, id: source.id })}
      className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full bg-doc px-2 py-0.5 text-[11.5px] leading-5 text-[var(--blue-ink)] transition-colors hover:bg-[var(--doc-press)] [&_svg]:size-3 [&_svg]:shrink-0"
      aria-label={`${tx.systems.record.kinds[source.kind]} ${doc && source.label ? source.label : source.id}. ${tx.chat.sources.open(source.id)}`}
      data-source={source.id}
    >
      <Icon aria-hidden="true" />
      {doc && source.label ? <span className="truncate font-medium">{source.label}</span> : <span className="truncate font-mono font-medium">{source.id}</span>}
      {!doc && source.label && <span className="truncate opacity-90">· {source.label}</span>}
    </button>
  )
}

// ---------------------------------------------------------------- tool steps

const STATUS_CHIP: Record<StepView['status'], string> = {
  running: 'bg-primary text-primary-foreground',
  awaiting: 'bg-primary text-primary-foreground',
  ok: 'bg-ok text-[var(--green-ink)]',
  error: 'bg-danger text-[var(--red-ink)]',
  neutral: 'bg-muted text-foreground',
  warning: 'bg-primary text-primary-foreground',
}
const STATUS_ICON: Record<StepView['status'], LucideIcon> = {
  running: LoaderCircle,
  awaiting: Hourglass,
  ok: Check,
  error: XCircle,
  neutral: CircleSlash,
  warning: AlertTriangle,
}

/**
 * The tool calls of one run, compact. Open while the run is active; after it,
 * folded to a one-line summary unless a step did not succeed.
 */
export function RunSteps({ runId, steps, active, onResize }: { runId: string; steps: StepView[]; active: boolean; onResize?: () => void }) {
  const tx = useT().chat.steps
  const issues = steps.filter((s) => s.status === 'error' || s.status === 'warning' || s.status === 'neutral').length
  const [open, setOpen] = useState(active || issues > 0)
  useEffect(() => {
    setOpen(active || issues > 0)
  }, [active, issues])
  // Folding changes the list height: let the panel keep the newest item in view when it was pinned there.
  useLayoutEffect(() => {
    onResize?.()
  }, [open])
  if (!steps.length) return null
  return (
    <AgentRow testId="run-steps">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-2 bg-subtle px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.title}</span>
          <span className="text-[12px] text-[var(--ink-2)]">{tx.count(steps.length)}{issues > 0 ? ` · ${tx.issues(issues)}` : ''}</span>
          <ChevronDown className={cn('ml-auto size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {open && (
          <ol className="divide-y divide-[var(--line)] border-t border-hairline">
            {steps.map((s) => <StepRow key={s.callId} runId={runId} step={s} />)}
          </ol>
        )}
      </div>
    </AgentRow>
  )
}

function StepRow({ runId, step }: { runId: string; step: StepView }) {
  const tx = useT().chat.steps
  const itemId = `tool:${step.callId}`
  const selected = useStore((s) => s.selectedTraceItem?.runId === runId && s.selectedTraceItem.itemId === itemId)
  const SysIcon = step.system ? SYSTEM_ICON[step.system] : CircleSlash
  const StatusIcon = STATUS_ICON[step.status]
  const label = step.code ? tx.codes[step.code] : tx.status[step.status as 'running' | 'awaiting' | 'ok']
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          selectTraceItem({ runId, itemId })
          if (!window.matchMedia('(min-width: 1100px)').matches) setUi({ mobileTab: 'workspace' })
        }}
        aria-label={`${tx.open(step.name)}: ${label}`}
        aria-pressed={selected}
        title={step.summary}
        className={cn('flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-subtle', selected && 'bg-muted hover:bg-muted')}
        data-step={step.callId}
        data-step-status={step.status}
        data-step-code={step.code}
      >
        <span aria-hidden="true" className={cn('inline-grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-3.5', step.system ? 'bg-doc text-[var(--blue-ink)]' : 'bg-muted text-foreground')}>
          <SysIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] font-medium text-foreground">{step.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{step.system ? tx.systems[step.system] : tx.unknownSystem}</span>
        </span>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium leading-4 [&_svg]:size-3', STATUS_CHIP[step.status])}>
          <StatusIcon className={cn(step.status === 'running' && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
          {label}
        </span>
      </button>
    </li>
  )
}

// ---------------------------------------------------------------- typing, notices

/** Three dots while the agent works. Hidden from screen readers: the status is announced once by the live region. */
export function TypingIndicator() {
  const tx = useT().chat.messages
  return (
    <AgentRow testId="typing">
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-3 shadow-sm" aria-hidden="true" title={tx.typing}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-pulse rounded-full bg-[var(--ink-3)] motion-reduce:animate-none" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </AgentRow>
  )
}

const NOTICE_TONE = { cancelled: 'stone', limit: 'warn', error: 'danger' } as const
const NOTICE_ICON = { cancelled: CircleSlash, limit: AlertTriangle, error: XCircle }

type NoticeItemT = Extract<ChatItem, { kind: 'notice' }>
type Dict = ReturnType<typeof useT>

/**
 * What a run notice says. `reason` is the run's end code (`run_finished.detail`):
 * a Worker rate limit or a used-up budget is explained with what the learner can
 * do; any other limit says it is a limit of this lab.
 */
export function noticeContent(item: NoticeItemT, reason: string | null, tx: Dict): { tone: 'stone' | 'warn' | 'danger'; icon: LucideIcon; title: string; body: string; note?: string; detail?: string } {
  const n = tx.chat.notices
  if (reason === 'rate_limited') return { tone: 'warn', icon: Timer, title: n.rateLimitedTitle, body: n.rateLimited }
  if (reason === 'quota_exceeded' || item.messageKey === 'quota_exceeded') return { tone: 'warn', icon: Gauge, title: n.quotaTitle, body: n.quota }
  const base = { tone: NOTICE_TONE[item.outcome], icon: NOTICE_ICON[item.outcome], title: n[item.outcome], body: tx.shell.runNotices[item.messageKey] }
  if (item.outcome === 'limit') return { ...base, note: n.limitNote }
  if (item.outcome === 'error' && item.detail) return { ...base, detail: item.detail }
  return base
}

/** A run that ended without a normal answer. Not a live region itself: the panel's polite announcer reads it once. */
export function NoticeItem({ item, reason }: { item: NoticeItemT; reason: string | null }) {
  const tx = useT()
  const c = noticeContent(item, reason, tx)
  const Icon = c.icon
  return (
    <AgentRow testId="run-notice">
      <div className="flex gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5" data-outcome={item.outcome} data-reason={reason ?? undefined}>
        <IconBadge size="sm" tone={c.tone}><Icon /></IconBadge>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <div className="font-display text-[14px] font-bold">{c.title}</div>
          <p className="mt-0.5 text-[var(--ink-2)]">{c.body}</p>
          {c.note && <p className="mt-1 text-[12px] text-muted-foreground">{c.note}</p>}
          {c.detail && (
            <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground"><span className="uppercase tracking-[0.08em]">{tx.chat.notices.detail}:</span> {c.detail}</p>
          )}
        </div>
      </div>
    </AgentRow>
  )
}
