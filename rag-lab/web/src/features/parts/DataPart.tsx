import { useStore } from '@/state/store'
import { FileExplorer } from '../FileExplorer'

/** Part 2. Students: which documents the assistant may use (a tick = membership). Tech: the files and their parameters. */
export function DataPart() {
  const view = useStore((s) => s.settings.view)
  return (
    <div data-testid="part-data" data-view={view} className="mx-auto h-full max-w-[54rem] border-x bg-card">
      <FileExplorer view={view} />
    </div>
  )
}
