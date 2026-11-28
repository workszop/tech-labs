import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, Clock, Eye, Pencil, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import type { BenchmarkCase, CaseResult } from '@/rag/benchmark'
import { allCases, setOverride, toggleCase } from '@/state/benchmark'
import { setState, useStore, type BenchmarkRun } from '@/state/store'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SectionCard, fmtDateTime } from '../common'
import { CaseDetail } from './CaseDetail'
import { KindBadge, VerdictMark, kindLookup } from './shared'
import { caseVerdict, runSummary, verdictLines } from './verdict'

function setTicked(id: string, on: boolean) {
  setState((s) => ({ bench: { ...s.bench, ticked: on ? [...new Set([...s.bench.ticked, id])] : s.bench.ticked.filter((x) => x !== id) } }))
}

/** One row per case; the marks come from `run` (the latest run, or the one picked in the runs table). */
export function CaseTable({ run, onOpenCase }: { run: BenchmarkRun | null; onOpenCase: (c: BenchmarkCase) => void }) {
  const s = useStore((st) => st)
  const tech = s.settings.view === 'tech'
  const tx = useT().lab.benchmark
  const [open, setOpen] = useState<string[]>([])
  const cases = allCases(s)
  const off = new Set(s.settings.benchOff)
  const ticked = new Set(s.bench.ticked)
  const byCase = new Map((run?.results ?? []).map((r) => [r.caseId, r]))
  const summary = run ? runSummary(run.results, kindLookup(run, s), run.caseIds.length, run.totalActive) : null
  const lines = summary && run?.status !== 'running' ? verdictLines(summary) : []
  return (
    <SectionCard
      icon={<ClipboardList />}
      title={tx.casesTitle}
      data-testid="bench-cases"
      data-run-id={run?.id ?? ''}
      right={run ? <span>{tx.showingRun(fmtDateTime(run.createdAt))}</span> : undefined}
      bodyClassName="p-0"
    >
      <div className="space-y-1.5 border-b border-hairline px-4 py-3" data-testid="bench-verdict">
        {summary ? (
          <>
            <p className="font-display text-[22px] font-extrabold tabular-nums" data-testid="bench-score" data-full={summary.full}>
              <span className="mr-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{tx.scoreLabel}</span>
              {tx.score(summary.passed, summary.done, summary.totalActive)}
            </p>
            {lines.map((l) => (
              <p key={l.key} data-line={l.key} className={cn('text-[13.5px] font-medium', l.key === 'goodEnough' ? 'text-ok' : l.key === 'notYet' ? 'text-danger' : 'text-[var(--ink-2)]')}>
                {l.key === 'goodEnough' ? tx.goodEnough : l.key === 'partial' ? tx.partial : l.key === 'notYet' ? tx.notYet(l.kinds.map((k) => tx.kinds[k])) : tx.waiting(l.n)}
              </p>
            ))}
            {run?.error && <p className="text-[12.5px] text-danger" data-testid="bench-run-error">{run.error}</p>}
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">{tx.noRunYet}</p>
        )}
      </div>
      <ul className="divide-y divide-hairline">
        {cases.map((c) => {
          const r = byCase.get(c.id)
          const v = r ? caseVerdict(r) : null
          const isOpen = open.includes(c.id)
          return (
            <Fragment key={c.id}>
              <li data-case={c.id} data-verdict={v === 'pass' || v === 'fail' || v === 'waiting' ? v : 'none'} data-status={r?.status ?? 'none'} className={cn('px-3 py-2.5', off.has(c.id) && 'opacity-60')}>
                <div className="flex flex-wrap items-start gap-x-2.5 gap-y-2">
                  <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <Checkbox checked={ticked.has(c.id)} onCheckedChange={(v) => setTicked(c.id, v === true)} aria-label={tx.tickAria(c.question)} data-testid="bench-tick" />
                    <Switch checked={!off.has(c.id)} onCheckedChange={(v) => toggleCase(c.id, v)} aria-label={tx.activeAria(c.question)} data-testid="bench-active" />
                  </div>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <KindBadge kind={c.kind} />
                      {c.builtIn && <Badge variant="outline">{tx.builtIn}</Badge>}
                      <button type="button" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-doc underline underline-offset-2 cursor-pointer" onClick={() => onOpenCase(c)} data-testid="bench-edit">
                        {c.builtIn ? <Eye className="size-3" /> : <Pencil className="size-3" />} {c.builtIn ? tx.view : tx.edit}
                      </button>
                    </div>
                    <p className="mt-1 text-[13.5px] leading-snug">{c.question}</p>
                  </div>
                  <Marks r={r} />
                  <button type="button" className="flex items-center gap-1 self-center rounded-full px-2 py-1 text-[12px] font-medium hover:bg-muted cursor-pointer" aria-expanded={isOpen} onClick={() => setOpen((o) => (o.includes(c.id) ? o.filter((x) => x !== c.id) : [...o, c.id]))} data-testid="bench-row-toggle">
                    {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} {isOpen ? tx.hide : tx.details}
                  </button>
                </div>
              </li>
              {isOpen && (
                <li className="list-none">
                  <CaseDetail c={c} info={run?.caseInfo?.[c.id]} result={r} tech={tech} />
                </li>
              )}
            </Fragment>
          )
        })}
      </ul>
    </SectionCard>
  )
}

/** Retrieval mark with the share, answer mark, the case verdict and the override buttons (finished cases only). */
function Marks({ r }: { r?: CaseResult }) {
  const tx = useT().lab.benchmark
  if (!r) return <div className="flex items-center self-center"><VerdictMark v="none" /></div>
  const v = caseVerdict(r)
  const ret = r.retrieval
  const found = ret ? ret.expected.filter((e) => e.inContext).length : 0
  return (
    <div className="flex flex-wrap items-center gap-1.5 self-center" data-testid="bench-marks">
      {r.status === 'done' && (
        <>
          <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground" title={tx.cols.retrieval}>
            {tx.cols.retrieval}:
            {ret?.applicable ? <Badge variant={ret.pass ? 'ok' : 'danger'} data-testid="bench-retrieval">{found}/{ret.expected.length}</Badge> : <Badge data-testid="bench-retrieval">{tx.mark.na}</Badge>}
          </span>
          <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground" title={tx.cols.answer}>
            {tx.cols.answer}:
            <Badge variant={r.answer?.pass === true ? 'ok' : r.answer?.pass === false ? 'danger' : 'warn'} data-testid="bench-answer" data-pass={String(r.answer?.pass ?? null)}>
              {r.answer?.pass === true ? tx.mark.pass : r.answer?.pass === false ? tx.mark.fail : <><Clock /> {tx.mark.yourVerdict}</>}
            </Badge>
          </span>
        </>
      )}
      <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground" data-testid="bench-verdict-mark">
        {tx.cols.verdict}: <VerdictMark v={v} />
      </span>
      {r.status === 'error' && r.error && <span className="basis-full text-[12px] text-danger" data-testid="bench-case-error">{r.error}</span>}
      {r.status === 'done' && r.runId && <Override r={r as CaseResult & { runId: string }} />}
    </div>
  )
}

function Override({ r }: { r: CaseResult & { runId: string } }) {
  const tx = useT().lab.benchmark
  const running = useStore((s) => s.bench.currentRunId === r.runId)
  if (r.override)
    return (
      <span className="flex items-center gap-1">
        <Badge variant="outline" data-testid="bench-overridden">{tx.overridden}</Badge>
        <Button variant="ghost" size="xs" onClick={() => void setOverride(r.runId, r.caseId, null)} data-testid="bench-undo">
          <Undo2 /> {tx.undo}
        </Button>
      </span>
    )
  return (
    <span className="flex items-center gap-1" role="group" aria-label={tx.cols.override}>
      <Button variant="outline" size="xs" disabled={running} onClick={() => void setOverride(r.runId, r.caseId, 'pass')} data-testid="bench-override-pass">{tx.passBtn}</Button>
      <Button variant="outline" size="xs" disabled={running} onClick={() => void setOverride(r.runId, r.caseId, 'fail')} data-testid="bench-override-fail">{tx.failBtn}</Button>
    </span>
  )
}
