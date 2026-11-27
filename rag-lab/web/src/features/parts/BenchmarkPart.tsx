import { ClipboardCheck } from 'lucide-react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { EmptyState } from '../common'

/** Part 5: the benchmark. Task 7 fills it. */
export function BenchmarkPart() {
  const view = useStore((s) => s.settings.view)
  const title = useT().shell.parts.benchmark
  return (
    <div data-testid="part-benchmark" data-view={view} className="mx-auto max-w-4xl p-4 sm:p-5">
      <EmptyState icon={<ClipboardCheck />} title={title} />
    </div>
  )
}
