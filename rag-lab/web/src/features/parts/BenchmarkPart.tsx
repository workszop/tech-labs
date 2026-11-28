import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BenchmarkCase } from '@/rag/benchmark'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { CaseEditor } from '../benchmark/CaseEditor'
import { CaseTable } from '../benchmark/CaseTable'
import { RunBar } from '../benchmark/RunBar'
import { RunsTable } from '../benchmark/RunsTable'

/**
 * Part 5: the benchmark. Both faces: the run bar, the case table (the latest run or the one picked in the
 * runs table) and the runs. The Tech face's row details add ranks, scores and the full trace.
 */
export function BenchmarkPart() {
  const view = useStore((s) => s.settings.view)
  const runs = useStore((s) => s.bench.runs)
  const tx = useT().lab.benchmark
  // null: follow the latest run.
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ c?: BenchmarkCase } | null>(null)
  const run = (picked && runs.find((r) => r.id === picked)) || runs.at(-1) || null
  return (
    <div data-testid="part-benchmark" data-view={view} className="mx-auto max-w-4xl space-y-4 p-4 sm:p-5">
      <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{tx.intro}</p>
      <RunBar onStart={() => setPicked(null)} />
      <CaseTable run={run} onOpenCase={(c) => setEditing({ c })} />
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing({})} data-testid="bench-add-case">
          <Plus /> {tx.addCase}
        </Button>
      </div>
      <RunsTable selectedId={run?.id ?? null} onSelect={(id) => setPicked(id === runs.at(-1)?.id ? null : id)} />
      {editing && <CaseEditor c={editing.c} onClose={() => setEditing(null)} />}
    </div>
  )
}
