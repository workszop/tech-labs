/**
 * The timeline: one row per event group of the run, in the order the events
 * happened. Rows are buttons (Tab, Enter / Space, Arrow Up / Down, Home / End);
 * the selected row opens the inspector under itself.
 */
import * as React from 'react'
import { useEffect, useRef } from 'react'
import { ArrowRight, Bot, Eye, Hand, MessageSquareText, PenLine, User, X } from 'lucide-react'
import { noticeKeyFor } from '@/agent/types'
import { Badge } from '@/components/ui/badge'
import { cn, formatNumber } from '@/lib/utils'
import { useT } from '@/i18n'
import { SYSTEM_ICON } from './FlowGraph'
import { ItemDetails } from './Inspector'
import { CallDuration, CallStatusChip, fmtDuration, reveal } from './ui'
import type { TimelineItem, TraceView } from './trace'

export interface TimelineProps {
  trace: TraceView
  selected: string | null
  /** Rows that belong to the selected graph node. */
  marked: ReadonlySet<string>
  onSelect: (id: string) => void
  /** Keeps the newest row in view while following a live run or a replay. */
  following: boolean
}

export function Timeline({ trace, selected, marked, onSelect, following }: TimelineProps) {
  const tx = useT().flow
  const list = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (!selected || !list.current) return
    const row = list.current.querySelector<HTMLElement>(`[data-row="${CSS.escape(selected)}"]`)
    if (row) reveal(row)
  }, [selected, following, trace.items.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(e.key) || !list.current) return
    const rows = [...list.current.querySelectorAll<HTMLButtonElement>('button[data-row-button]')]
    const i = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
    const row = rows[next]
    if (!row) return
    row.focus({ preventScroll: true })
    reveal(row)
  }

  return (
    <ol ref={list} className="space-y-1.5" aria-label={tx.panel.timelineLabel} onKeyDown={onKeyDown} data-testid="timeline">
      {trace.items.map((item) => (
        <Row key={item.id} item={item} trace={trace} selected={selected === item.id} marked={marked.has(item.id)} onSelect={onSelect} />
      ))}
    </ol>
  )
}

function Row({ item, trace, selected, marked, onSelect }: { item: TimelineItem; trace: TraceView; selected: boolean; marked: boolean; onSelect: (id: string) => void }) {
  const t = useT().flow.timeline
  const panelId = `inspector-${item.id.replace(/[^\w-]/g, '_')}`
  const state = rowState(item)
  return (
    <li
      data-row={item.id}
      data-state={state}
      className={cn(
        'overflow-hidden rounded-lg border bg-card transition-colors',
        selected ? 'border-foreground shadow-sm' : marked ? 'border-foreground' : 'border-hairline',
      )}
    >
      <button
        type="button"
        data-row-button
        onClick={() => onSelect(item.id)}
        aria-expanded={selected}
        aria-controls={selected ? panelId : undefined}
        className={cn('flex w-full cursor-pointer items-start gap-2 px-2.5 py-2 text-left transition-colors', selected ? 'bg-subtle' : 'hover:bg-subtle')}
      >
        <RowIcon item={item} />
        <RowBody item={item} trace={trace} />
      </button>
      {selected && (
        <div id={panelId} role="region" aria-label={rowTitle(item, t)} className="border-t border-hairline px-2.5 pb-3 pt-2.5">
          <ItemDetails item={item} trace={trace} />
        </div>
      )}
    </li>
  )
}

function rowState(item: TimelineItem): string {
  switch (item.kind) {
    case 'tool':
      return item.call.status
    case 'confirm':
      return item.call.confirmation?.state ?? 'pending'
    case 'model':
      return item.turn.status
    case 'final':
      return item.outcome
    default:
      return 'done'
  }
}

type TimelineDict = ReturnType<typeof useT>['flow']['timeline']
function rowTitle(i: TimelineItem, t: TimelineDict): string {
  if (i.kind === 'customer') return t.customer
  if (i.kind === 'model') return t.modelTurn(i.turn.step)
  if (i.kind === 'tool') return i.call.name || t.unknownTool
  if (i.kind === 'confirm') return t.confirm
  return i.outcome === 'answered' ? t.final : t.notice
}

function RowIcon({ item }: { item: TimelineItem }) {
  const base = 'mt-0.5 inline-grid size-[26px] shrink-0 place-items-center rounded-md [&_svg]:size-3.5'
  switch (item.kind) {
    case 'customer':
      return <span aria-hidden="true" className={cn(base, 'bg-foreground text-[var(--yellow)]')}><User /></span>
    case 'model':
      return <span aria-hidden="true" className={cn(base, 'bg-query text-[var(--grape-ink)]')}><Bot /></span>
    case 'tool': {
      if (!item.call.system) return <span aria-hidden="true" className={cn(base, 'bg-danger text-[var(--red-ink)]')}><X /></span>
      const Icon = SYSTEM_ICON[item.call.system]
      return <span aria-hidden="true" className={cn(base, 'bg-doc text-[var(--blue-ink)]')}><Icon /></span>
    }
    case 'confirm':
      return <span aria-hidden="true" className={cn(base, 'bg-primary text-primary-foreground')}><Hand /></span>
    case 'final':
      return <span aria-hidden="true" className={cn(base, 'bg-foreground text-[var(--yellow)]')}><MessageSquareText /></span>
  }
}

function RowBody({ item, trace }: { item: TimelineItem; trace: TraceView }) {
  const tx = useT()
  const t = tx.flow.timeline
  const title = 'min-w-0 font-display text-[13px] font-bold leading-snug'
  const meta = 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10.5px] leading-4 text-[var(--ink-2)]'

  switch (item.kind) {
    case 'customer':
      return (
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={title}>{t.customer}</span>
            <span className="shrink-0 font-mono text-[10.5px] text-[var(--ink-2)]">{item.customerId}</span>
          </span>
          <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--ink-2)]">„{item.message}”</span>
        </span>
      )
    case 'model': {
      const turn = item.turn
      const tokens = turn.usage ? turn.usage.inputTokens + turn.usage.outputTokens : null
      const asked = trace.calls.filter((c) => c.step === turn.step).length
      return (
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={title}>{t.modelTurn(turn.step)}</span>
            {turn.status === 'running' ? (
              <Badge variant="warn">{t.modelRunning}</Badge>
            ) : turn.status === 'interrupted' ? (
              <Badge>{t.modelInterrupted}</Badge>
            ) : (
              <span className="shrink-0 font-mono text-[11px] text-[var(--ink-2)]">{fmtDuration(turn.durationMs ?? 0)}</span>
            )}
          </span>
          {turn.status === 'done' && (
            <span className={cn(meta, 'mt-0.5')}>
              <span className="font-sans text-[12px]">{turn.kind === 'final' ? t.finalText : asked ? t.askedTools(asked) : t.askedNothing}</span>
              {tokens !== null && <span>· {t.tokens(formatNumber(tokens))}</span>}
              {turn.forcedFinal && <Badge variant="warn">{t.forcedFinal}</Badge>}
            </span>
          )}
        </span>
      )
    }
    case 'tool': {
      const c = item.call
      return (
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={cn(title, 'break-all font-mono text-[12.5px]')}>{c.name || t.unknownTool}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <CallDuration call={c} />
              <CallStatusChip call={c} />
            </span>
          </span>
          <span className={cn(meta, 'mt-0.5')}>
            <span>{t.stepCall(c.step, c.seq)}</span>
            <span className="inline-flex items-center gap-0.5 rounded-full border border-input px-1.5 leading-[14px]">
              {c.readOnly ? <Eye aria-hidden="true" className="size-2.5" /> : <PenLine aria-hidden="true" className="size-2.5" />}
              {c.readOnly ? t.readOnly : t.changesData}
            </span>
            {c.parallel > 1 && (
              <span className="rounded-full bg-foreground px-1.5 leading-[14px] text-background" title={t.parallelHint}>{t.parallel(c.parallel)}</span>
            )}
            {c.next !== null && (
              <span className="inline-flex items-center gap-0.5">
                {c.next === 'last' ? t.lastCall : <><ArrowRight aria-hidden="true" className="size-2.5" />{t.thenCall(c.next)}</>}
              </span>
            )}
          </span>
          {c.result && c.status !== 'neutral' && <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--ink-2)]" data-summary>{c.result.summary}</span>}
        </span>
      )
    }
    case 'confirm': {
      const state = item.call.confirmation?.state ?? 'pending'
      return (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="min-w-0">
            <span className={cn(title, 'block')}>{t.confirm}</span>
            <span className={meta}>#{item.call.seq} {item.call.name}</span>
          </span>
          <Badge variant={state === 'approved' ? 'ok' : state === 'pending' || state === 'rejected' ? 'warn' : 'default'}>{t.confirmState[state]}</Badge>
        </span>
      )
    }
    case 'final': {
      const answered = item.outcome === 'answered'
      const notice = answered ? null : tx.shell.runNotices[noticeKeyFor(item.detail, item.outcome)]
      return (
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className={title}>{answered ? t.final : t.notice}</span>
            <Badge variant={answered ? 'ok' : item.outcome === 'error' ? 'danger' : 'warn'}>{tx.flow.inspector.outcomeLabel[item.outcome]}</Badge>
          </span>
          {notice && <span className="mt-0.5 block text-[12px] leading-snug text-foreground">{notice}</span>}
          {item.answer && <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--ink-2)]">{item.answer}</span>}
        </span>
      )
    }
  }
}
