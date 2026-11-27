import { useStore } from '@/state/store'
import { FileExplorer } from '../FileExplorer'

/** Part 2: which documents the assistant may use. Task 2 gives the two faces their own content. */
export function DataPart() {
  const view = useStore((s) => s.settings.view)
  return (
    <div data-testid="part-data" data-view={view} className="mx-auto h-full max-w-[54rem] border-x bg-card">
      <FileExplorer />
    </div>
  )
}
