import { Bot } from 'lucide-react'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { EmptyState } from '../common'

/** Part 4: the generator. Task 3 fills it. */
export function GeneratorPart() {
  const view = useStore((s) => s.settings.view)
  const title = useT().shell.parts.generator
  return (
    <div data-testid="part-generator" data-view={view} className="mx-auto max-w-4xl p-4 sm:p-5">
      <EmptyState icon={<Bot />} title={title} />
    </div>
  )
}
