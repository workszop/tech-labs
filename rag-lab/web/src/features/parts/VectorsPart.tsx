import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { useStore } from '@/state/store'
import { IndexBuilder, IndexOverview } from '../IndexBuilder'

const EmbeddingMap = lazy(() => import('../EmbeddingMap').then((m) => ({ default: m.EmbeddingMap })))
const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" />
  </div>
)

/** Part 3. Students: building the index. Tech: what is stored, and the vector map. */
export function VectorsPart() {
  const view = useStore((s) => s.settings.view)
  return (
    <div data-testid="part-vectors" data-view={view}>
      {view === 'students' ? (
        <IndexBuilder />
      ) : (
        <>
          <div className="mx-auto max-w-4xl p-4 sm:p-5">
            <IndexOverview />
          </div>
          <div className="h-[80vh] min-h-[32rem] border-t">
            <Suspense fallback={<Loading />}><EmbeddingMap /></Suspense>
          </div>
        </>
      )}
    </div>
  )
}
