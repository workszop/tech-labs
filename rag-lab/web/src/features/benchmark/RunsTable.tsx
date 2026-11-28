import { Download, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { downloadRunsCsv } from '@/state/benchmark'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SectionCard, fmtDateTime } from '../common'
import { kindLookup } from './shared'
import { runSummary } from './verdict'

const TH = 'whitespace-nowrap px-2.5 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground'
const TD = 'whitespace-nowrap px-2.5 py-2 tabular-nums'

/** One row per run, newest first, with its settings and score. A row shows that run in the case table. */
export function RunsTable({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const s = useStore((st) => st)
  const dict = useT().lab
  const tx = dict.benchmark
  const runs = [...s.bench.runs].reverse()
  return (
    <SectionCard
      icon={<History />}
      title={tx.runsTitle}
      data-testid="bench-runs"
      bodyClassName="p-0"
      foot={
        <Button variant="outline" size="sm" className="ml-auto" disabled={runs.length === 0} onClick={downloadRunsCsv} data-testid="bench-export">
          <Download /> {tx.export}
        </Button>
      }
    >
      {runs.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">{tx.noRuns}</p>
      ) : (
        // A wide table scrolls inside its own box; the page never scrolls sideways.
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-hairline">
              <tr>
                {(['time', 'docs', 'chunkSize', 'overlap', 'labels', 'topK', 'threshold', 'score', 'status'] as const).map((k) => (
                  <th key={k} className={TH}>{tx.runCols[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {runs.map((r) => {
                const sum = runSummary(r.results, kindLookup(r, s), r.caseIds.length, r.totalActive)
                const selected = r.id === selectedId
                const time = fmtDateTime(r.createdAt)
                return (
                  <tr
                    key={r.id}
                    data-run-id={r.id}
                    data-selected={selected}
                    data-status={r.status}
                    data-partial={!sum.full}
                    tabIndex={0}
                    aria-label={tx.selectRun(time)}
                    aria-selected={selected}
                    className={cn('cursor-pointer transition-colors hover:bg-muted', selected && 'bg-[var(--yellow)]/25')}
                    onClick={() => onSelect(r.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(r.id))}
                  >
                    <td className={TD}>{time}</td>
                    <td className={TD}>{r.index.docIds.length}</td>
                    <td className={TD}>{r.index.chunkSize ?? '–'}</td>
                    <td className={TD}>{r.index.overlap ?? '–'}</td>
                    <td className={TD}>{dict.chat.labelNames[r.index.labels] ?? r.index.labels}</td>
                    <td className={TD}>{r.topK}</td>
                    <td className={TD}>{r.threshold === null ? dict.vectors.thresholdOff : r.threshold.toFixed(2)}</td>
                    <td className={cn(TD, 'font-semibold')}>
                      {tx.score(sum.passed, sum.done, sum.totalActive)} {!sum.full && r.status !== 'running' && <Badge variant="warn" data-testid="bench-partial">{tx.partialTag}</Badge>}
                    </td>
                    <td className="px-2.5 py-2">
                      <Badge variant={r.status === 'done' ? 'ok' : r.status === 'error' ? 'danger' : r.status === 'running' ? 'warn' : 'default'}>{tx.runStatus[r.status]}</Badge>
                      {r.error && <div className="mt-1 max-w-72 whitespace-normal text-[11.5px] text-danger" data-testid="bench-run-row-error">{r.error}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
