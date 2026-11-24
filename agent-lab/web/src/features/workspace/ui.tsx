/** Small shared pieces of the centre panel: call status chips, durations, JSON blocks, record chips. */
import * as React from 'react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn, formatMs } from '@/lib/utils'
import { useT } from '@/i18n'
import { fitToolContent } from '@/agent/limits'
import { toolResultForModel, type ToolResult } from '@/sim/tools'
import { openRecordById, recordKindOf } from '@/features/systems/recordNav'
import { KIND_ICON } from '@/features/systems/ui'
import type { CallView } from './trace'

/** Chip with the state of a tool call: green done, yellow pending, red error, stone neutral. */
export function CallStatusChip({ call, className }: { call: CallView; className?: string }) {
  const tx = useT().flow
  const r = call.result
  // No result yet: rejected (the rejection result follows) or, in a finished run, never recorded.
  if (!r && call.status === 'warning') return <Badge variant="warn" className={className}>{tx.errorCode.rejected_by_user}</Badge>
  if (!r && call.status === 'neutral') return <Badge variant="default" className={className}>{tx.errorCode.result_unknown}</Badge>
  if (!r || call.status === 'running' || call.status === 'waiting') {
    return <Badge variant="warn" className={className}>{call.status === 'waiting' ? tx.callStatus.waiting : tx.callStatus.running}</Badge>
  }
  if (r.ok) return <Badge variant="ok" className={className}>{tx.callStatus.ok}</Badge>
  const variant = call.status === 'error' ? 'danger' : call.status === 'warning' ? 'warn' : 'default'
  return <Badge variant={variant} className={className} data-code={r.error.code}>{tx.errorCode[r.error.code]}</Badge>
}

/** Duration of a finished call; calls that never ran have none (not "0 ms"). */
export function CallDuration({ call, className }: { call: CallView; className?: string }) {
  const tx = useT().flow
  if (!call.result && call.status !== 'neutral' && call.status !== 'warning') return null
  if (call.durationMs === null) {
    return <span className={cn('font-mono text-[11px] text-muted-foreground', className)} title={tx.timeline.noDurationHint}>{tx.timeline.noDuration}</span>
  }
  return <span className={cn('font-mono text-[11px] text-[var(--ink-2)]', className)}>{fmtDuration(call.durationMs)}</span>
}

export function fmtDuration(ms: number): string {
  return ms < 1 ? '<1 ms' : formatMs(ms)
}

/** The exact text sent to the model for this result, and whether it was shortened (engine: `fitToolContent`). */
export function sentToModel(r: ToolResult): { text: string; shortened: boolean } {
  const full = toolResultForModel(r)
  const text = fitToolContent(full)
  return { text, shortened: text !== full }
}

function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/** A JSON block: formatted for reading, with a switch to the exact text. */
export function JsonBlock({ text, label, testId }: { text: string; label: string; testId?: string }) {
  const tx = useT().flow.inspector
  const [raw, setRaw] = useState(false)
  const shown = useMemo(() => (raw ? text : pretty(text)), [raw, text])
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <div className="flex items-center justify-between gap-2 border-b border-hairline bg-subtle px-2.5 py-1">
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{label}</span>
        <button type="button" onClick={() => setRaw(!raw)} aria-pressed={raw} className="cursor-pointer rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-2)] hover:bg-muted">
          {raw ? tx.formatted : tx.exact}
        </button>
      </div>
      <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap break-all bg-card px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-foreground" data-testid={testId}>{shown}</pre>
    </div>
  )
}

const ID_RE = /\b(?:CUST-\d{4}|ORD-\d{4}-\d{4}|SHIP-\d{4}-\d{3}|CASE-\d{4}-\d{3}|PRD-[A-Z]+-\d+|WAR-\d{4}|INT-\d{4}|TCK-\d{4}-\d{4}|DOC-[a-z0-9-]+)\b/g

/** Northstar record IDs mentioned in the given texts, in order of appearance, without duplicates. */
export function recordIds(...texts: string[]): string[] {
  const seen = new Set<string>()
  for (const t of texts) for (const m of t.matchAll(ID_RE)) if (recordKindOf(m[0])) seen.add(m[0])
  return [...seen]
}

/** Record IDs as solid blue chips that open the record or document dialog. */
export function RecordChips({ ids }: { ids: string[] }) {
  const tx = useT().systems.record
  if (!ids.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const kind = recordKindOf(id)!
        const Icon = KIND_ICON[kind]
        return (
          <button
            key={id}
            type="button"
            onClick={() => openRecordById(id)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-doc px-2 py-0.5 font-mono text-[11px] font-medium leading-5 text-[var(--blue-ink)] transition-colors hover:bg-[var(--doc-press)] [&_svg]:size-3"
            aria-label={`${tx.kinds[kind]} ${id}`}
            data-record-chip={id}
          >
            <Icon aria-hidden="true" />
            {id}
          </button>
        )
      })}
    </div>
  )
}

/** Mono functional label. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground', className)}>{children}</div>
}

/** A ruled key / value grid. */
export function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(84px,max-content)_1fr] overflow-hidden rounded-lg border border-hairline text-[12.5px]">
      {rows.map(([k, v], i) => (
        <React.Fragment key={k}>
          <dt className={cn('border-hairline bg-subtle px-2.5 py-1.5 font-mono text-[10.5px] font-medium uppercase leading-5 tracking-[0.06em]', i > 0 && 'border-t')}>{k}</dt>
          <dd className={cn('min-w-0 border-hairline px-2.5 py-1.5 leading-5 text-foreground', i > 0 && 'border-t')}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

/**
 * Scrolls only the panel's own scroll container so the row is visible (its top
 * first). `scrollIntoView` would also scroll clipped ancestors and the page.
 */
export function reveal(el: HTMLElement) {
  let box = el.parentElement
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement
  if (!box) return
  const b = box.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  if (r.top < b.top) box.scrollTop += r.top - b.top - 8
  else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom + 8, r.top - b.top - 8)
}
