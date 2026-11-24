/**
 * Two recorded runs side by side: customer, question, tools on and off, the
 * ordered tool calls with their summaries and statuses, the final answer or the
 * run notice, and totals. Calls that only one run made carry an "Only in A/B"
 * label (never colour alone), and each switched-off tool gets one neutral
 * sentence. Nothing is rated.
 */
import { useMemo } from 'react'
import { ArrowLeftRight, CircleSlash, GitCompareArrows, PowerOff } from 'lucide-react'
import { TOOL_NAMES } from '@shared/tools'
import { noticeKeyFor, type RunRecord } from '@/agent/types'
import type { Customer } from '@/data/company/types'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, currentLocale, formatMs } from '@/lib/utils'
import { useT } from '@/i18n'
import { useStore } from '@/state/store'
import { useTable } from '@/sim/db'
import { Markdown } from '../systems/DocumentView'
import { IconBadge } from '../common'
import { SYSTEM_ICON } from '../workspace/FlowGraph'
import type { CallStatus } from '../workspace/trace'
import { compareRuns, type CompareCall, type CompareSide } from './compare'

function timeOf(ms: number): string {
  return new Intl.DateTimeFormat(currentLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ms)
}
function short(text: string, n = 44): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

export function CompareDialog({ open, onOpenChange, a, b, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; a: string | null; b: string | null; onPick: (side: 'a' | 'b', id: string) => void }) {
  const tx = useT()
  const t = tx.learn.compare
  const runs = useStore((s) => s.runs)
  const customers = useTable<Customer>('customers')
  const runA = runs.find((r) => r.id === a) ?? null
  const runB = runs.find((r) => r.id === b) ?? null
  const finished = runs.filter((r) => r.outcome)
  const cmp = useMemo(() => (runA && runB && runA.id !== runB.id ? compareRuns(runA, runB) : null), [runA, runB])
  const numberOf = (id: string) => runs.findIndex((r) => r.id === id) + 1
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? id

  const picker = (side: 'a' | 'b', value: string | null) => (
    <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{t.pickLabel(side === 'a' ? 'A' : 'B')}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onPick(side, e.target.value)}
        className="h-9 min-w-0 cursor-pointer truncate rounded-full border border-input bg-card px-3 text-[13px] text-foreground"
        data-testid={`compare-pick-${side}`}
      >
        {[...finished].reverse().map((r) => {
          const src = r.repeatOf ? numberOf(r.repeatOf) : 0
          return (
            <option key={r.id} value={r.id}>
              {t.option(numberOf(r.id), timeOf(r.startedAt), short(r.message))}{src > 0 ? ` (${t.repeatTag(src)})` : ''}
            </option>
          )
        })}
      </select>
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide className="h-[88vh] max-w-6xl" data-testid="compare-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitCompareArrows aria-hidden="true" className="size-5" />{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2 border-b border-hairline px-5 py-2.5">
          {picker('a', a)}
          <button
            type="button"
            onClick={() => {
              if (a && b) {
                onPick('a', b)
                onPick('b', a)
              }
            }}
            className="mb-0.5 inline-grid size-8 cursor-pointer place-items-center rounded-full border border-input bg-card hover:bg-muted [&_svg]:size-4"
            aria-label={`${t.runA} ⇄ ${t.runB}`}
          >
            <ArrowLeftRight aria-hidden="true" />
          </button>
          {picker('b', b)}
        </div>
        <DialogBody className="space-y-3 bg-subtle">
          {finished.length < 2 ? (
            <p className="text-[13.5px]">{t.needTwo}</p>
          ) : !cmp ? (
            <p className="text-[13.5px]">{t.sameRun}</p>
          ) : (
            <>
              <section aria-label={t.differences} className="rounded-lg border border-border bg-card px-3.5 py-2.5" data-testid="compare-differences">
                <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{t.differences}</h3>
                <ul className="mt-1 space-y-1 text-[13.5px] leading-snug">
                  <li data-testid="compare-only-count">{t.onlyCount(cmp.onlyA, cmp.onlyB)}</li>
                  {cmp.notes.map((n) => (
                    <li key={`${n.side}-${n.tool}`} className="flex gap-1.5" data-testid="compare-note">
                      <PowerOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                      <span>{t.noAccess(n.side === 'a' ? 'A' : 'B', n.side === 'a' ? 'B' : 'A', n.tool, tx.flow.nodes.systems[n.system], n.otherCalls)}</span>
                    </li>
                  ))}
                  {cmp.a.run.customerId !== cmp.b.run.customerId && <li>{t.otherCustomer}</li>}
                </ul>
              </section>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Side label="A" side={cmp.a} name={nameOf(cmp.a.run.customerId)} number={numberOf(cmp.a.run.id)} />
                <Side label="B" side={cmp.b} name={nameOf(cmp.b.run.customerId)} number={numberOf(cmp.b.run.id)} />
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

const STATUS_VARIANT: Record<CallStatus, 'ok' | 'warn' | 'danger' | 'default'> = { ok: 'ok', running: 'warn', waiting: 'warn', warning: 'warn', error: 'danger', neutral: 'default' }

function Side({ label, side, name, number }: { label: 'A' | 'B'; side: CompareSide; name: string; number: number }) {
  const tx = useT()
  const t = tx.learn.compare
  const run: RunRecord = side.run
  const notice = side.outcome && side.outcome !== 'answered' ? tx.shell.runNotices[noticeKeyFor(side.endReason ?? undefined, side.outcome)] : null
  const field = (title: string, body: React.ReactNode, testId?: string) => (
    <div className="border-t border-hairline px-3 py-2" data-testid={testId}>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{title}</div>
      <div className="mt-0.5 text-[13px] leading-snug">{body}</div>
    </div>
  )
  return (
    <section aria-label={label === 'A' ? t.runA : t.runB} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card" data-testid={`compare-side-${label.toLowerCase()}`}>
      <div className="flex items-center gap-2 bg-subtle px-3 py-2">
        <span aria-hidden="true" className="inline-grid size-7 shrink-0 place-items-center rounded-md bg-foreground font-display text-[15px] font-bold text-[var(--yellow)]">{label}</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14.5px] font-bold leading-tight">{label === 'A' ? t.runA : t.runB} <span className="font-mono text-[11px] font-normal text-[var(--ink-2)]">#{number} · {timeOf(run.startedAt)}</span></div>
        </div>
        {side.outcome && <Badge variant={side.outcome === 'answered' ? 'ok' : side.outcome === 'error' ? 'danger' : 'warn'}>{tx.flow.finalNode[side.outcome]}</Badge>}
      </div>
      {field(t.customer, <>{name} <span className="font-mono text-[11.5px] text-[var(--ink-2)]">{run.customerId}</span></>)}
      {field(t.question, <q className="italic">{run.message}</q>)}
      {field(
        t.toolsOn(side.enabled.length, TOOL_NAMES.length),
        <span className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[12px] text-[var(--ink-2)]">{t.toolsOff}:</span>
          {side.disabled.length === 0 ? (
            <span className="text-[12.5px]">{t.noneOff}</span>
          ) : (
            side.disabled.map((n) => (
              <Badge key={n} variant="solid" data-off-tool={n}><PowerOff aria-hidden="true" />{n}</Badge>
            ))
          )}
        </span>,
        'compare-tools',
      )}
      <div className="border-t border-hairline px-3 py-2">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{t.calls}</div>
        {side.calls.length === 0 ? (
          <p className="mt-0.5 text-[13px] text-[var(--ink-2)]">{t.noCalls}</p>
        ) : (
          <ol className="mt-1 space-y-1" data-testid="compare-calls">
            {side.calls.map((c) => <CallRow key={c.callId} call={c} side={label} />)}
          </ol>
        )}
      </div>
      {field(
        notice ? t.endedWith : t.answer,
        <>
          {notice && <p className="mb-1 rounded-md bg-muted px-2 py-1 text-[12.5px]">{notice}</p>}
          {side.answer ? <div className="max-h-64 overflow-y-auto text-[13px]"><Markdown text={side.answer} /></div> : !notice && <span className="text-[var(--ink-2)]">{t.noAnswer}</span>}
        </>,
        'compare-answer',
      )}
      <dl className="grid grid-cols-4 border-t border-hairline bg-subtle text-center">
        {([
          [t.totals.steps, String(side.totals.steps)],
          [t.totals.toolCalls, String(side.totals.toolCalls)],
          [t.totals.duration, side.totals.durationMs === null ? '-' : formatMs(side.totals.durationMs)],
          [t.totals.tokens, new Intl.NumberFormat(currentLocale()).format(side.totals.tokens)],
        ] as const).map(([k, v]) => (
          <div key={k} className="px-1 py-1.5">
            <dt className="truncate font-mono text-[9.5px] font-medium uppercase tracking-[0.06em]">{k}</dt>
            <dd className="font-display text-[16px] font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function CallRow({ call, side }: { call: CompareCall; side: 'A' | 'B' }) {
  const tx = useT()
  const t = tx.learn.compare
  const Icon = call.system ? SYSTEM_ICON[call.system] : CircleSlash
  const statusWord = call.status === 'ok' || call.status === 'running' || call.status === 'waiting' ? tx.flow.callStatus[call.status] : tx.flow.state[call.status]
  return (
    <li className={cn('rounded-md border px-2 py-1', call.only ? 'border-foreground bg-[var(--warn-tint)]' : 'border-hairline')} data-call-name={call.name} data-only={call.only}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10.5px] text-[var(--ink-2)]">#{call.seq}</span>
        <IconBadge size="sm" tone={call.system ? 'doc' : 'stone'} className="size-5 rounded-[5px] [&_svg]:size-3"><Icon /></IconBadge>
        <span className="min-w-0 break-all font-mono text-[12px] font-semibold">{call.name}</span>
        <Badge variant={STATUS_VARIANT[call.status]} className="ml-auto">{statusWord}</Badge>
        {call.only && (
          <Badge variant="solid" title={t.onlyHint} data-testid="only-marker"><GitCompareArrows aria-hidden="true" />{t.only(side)}</Badge>
        )}
      </div>
      {call.summary && <p className="mt-0.5 text-[12px] leading-snug text-[var(--ink-2)]">{call.summary}</p>}
    </li>
  )
}
