import { useState } from 'react'
import { ArrowRight, Loader2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CASE_KINDS, type CaseKind } from '@/rag/benchmark'
import { canRun, cancelBenchmark, plannedCases, runBenchmark, type RunFilter } from '@/state/benchmark'
import { goTo } from '@/state/nav'
import { useStore, type AppState } from '@/state/store'
import { useT } from '@/i18n'
import { SEG, SectionCard, segItem } from '../common'

const runningRun = (st: AppState) => (st.bench.currentRunId ? st.bench.runs.find((r) => r.id === st.bench.currentRunId) : undefined)

type Scope = 'all' | 'kind' | 'ticked'
const SCOPES: Scope[] = ['all', 'kind', 'ticked']

/** Scope, cost and the run button; while a run is in progress, its progress and a stop button. */
export function RunBar({ onStart }: { onStart: () => void }) {
  const tx = useT().lab.benchmark
  const [scope, setScope] = useState<Scope>('all')
  const [kind, setKind] = useState<CaseKind>('ordinary')
  const ticked = useStore((st) => st.bench.ticked)
  const filter: RunFilter = scope === 'kind' ? { kind } : scope === 'ticked' ? { ids: ticked } : {}
  // Selected as one string, so the bar re-renders only when the check itself changes (not on every token).
  const checkKey = useStore((st) => {
    const c = canRun(filter, st)
    return JSON.stringify([c.ok, c.reason ?? null, c.requests, c.left, plannedCases(filter, st).length])
  })
  const [ok, reason, requests, left, cases] = JSON.parse(checkKey) as [boolean, ReturnType<typeof canRun>['reason'] | null, number, number | null, number]
  const check = { ok, reason: reason ?? undefined, requests, left }
  const done = useStore((st) => runningRun(st)?.results.length ?? null)
  const total = useStore((st) => runningRun(st)?.caseIds.length ?? null)
  const current = done !== null && total !== null ? { done, total } : null
  return (
    <SectionCard as="h2" icon={<Play />} title={tx.runBarTitle} data-testid="bench-runbar" data-scope={scope}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className={SEG} role="group" aria-label={tx.scopeAria}>
            {SCOPES.map((sc) => (
              <button key={sc} type="button" aria-pressed={scope === sc} className={segItem(scope === sc)} onClick={() => setScope(sc)} disabled={!!current} data-scope-option={sc}>
                {tx.scope[sc]}
              </button>
            ))}
          </div>
          {scope === 'kind' && (
            <div className={SEG} role="group" aria-label={tx.kindAria}>
              {CASE_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} className={segItem(kind === k)} onClick={() => setKind(k)} disabled={!!current} data-kind-option={k}>
                  {tx.kinds[k]}
                </button>
              ))}
            </div>
          )}
        </div>
        {current ? (
          <div className="flex flex-wrap items-center gap-3" data-testid="bench-progress">
            <span className="flex items-center gap-2 text-[13px]">
              <Loader2 className="size-4 animate-spin" /> {tx.progress(current.done, current.total)}
            </span>
            <Button variant="outline" size="sm" onClick={cancelBenchmark} data-testid="bench-cancel">
              <Square /> {tx.cancel}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="accent"
                size="sm"
                disabled={!check.ok}
                data-testid="bench-run"
                onClick={() => {
                  onStart()
                  void runBenchmark(filter)
                }}
              >
                <Play /> {tx.run}
              </Button>
              <span className="font-mono text-[12px] text-[var(--ink-2)]" data-testid="bench-cost">{tx.cost(cases, check.requests, check.left)}</span>
            </div>
            {!check.ok && check.reason && (
              <div className="flex flex-wrap items-center gap-2" data-testid="bench-reason" data-reason={check.reason}>
                <p className="text-[12.5px] text-muted-foreground">{check.reason === 'quota' && check.left === null ? tx.quotaUnknown : tx.reasons[check.reason]}</p>
                {(check.reason === 'stale-kb' || check.reason === 'empty-kb') && (
                  <Button variant="outline" size="xs" onClick={() => goTo('vectors')}>
                    {tx.goToVectors} <ArrowRight />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
