/** Small pieces shared by the benchmark screens. */
import { Check, Clock, Minus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BUILT_IN_CASES } from '@/data/benchmark'
import type { CaseKind } from '@/rag/benchmark'
import type { AppState, BenchmarkRun } from '@/state/store'
import { useT } from '@/i18n'
import type { CaseVerdict } from './verdict'

export function KindBadge({ kind }: { kind: CaseKind }) {
  const tx = useT().lab.benchmark
  const variant = kind === 'restricted' ? 'danger' : kind === 'missing' ? 'query' : kind === 'exception' ? 'warn' : 'doc'
  return <Badge variant={variant}>{tx.kinds[kind]}</Badge>
}

/** The kind of a case in a run: from the run's own record (a case may be deleted later), else from the cases. */
export function kindLookup(run: BenchmarkRun, s: AppState): (caseId: string) => CaseKind {
  const known = new Map<string, CaseKind>([...BUILT_IN_CASES[s.settings.lang], ...s.bench.customCases].map((c) => [c.id, c.kind]))
  return (id) => run.caseInfo?.[id]?.kind ?? known.get(id) ?? 'ordinary'
}

/** Case verdict as a chip; `waiting` reads "your verdict needed", apart from failed. */
export function VerdictMark({ v }: { v: CaseVerdict | 'none' }) {
  const m = useT().lab.benchmark.mark
  switch (v) {
    case 'pass':
      return <Badge variant="ok"><Check strokeWidth={3} /> {m.pass}</Badge>
    case 'fail':
      return <Badge variant="danger"><X strokeWidth={3} /> {m.fail}</Badge>
    case 'waiting':
      return <Badge variant="warn"><Clock /> {m.waiting}</Badge>
    case 'error':
      return <Badge variant="danger">{m.error}</Badge>
    case 'skipped':
      return <Badge><Minus /> {m.notRun}</Badge>
    default:
      return <span className="text-[12px] text-muted-foreground">–</span>
  }
}
