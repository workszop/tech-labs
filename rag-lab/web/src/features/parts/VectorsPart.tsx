import { lazy, Suspense } from 'react'
import { Cpu, Hammer, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { BuildControls, ChunkSettings, IndexOverview, JobSteps } from '../IndexBuilder'
import { SectionCard, Stat } from '../common'
import { RetrievalDecisions } from './RetrievalDecisions'
import { SplitPreview } from './SplitPreview'
import { MapOptions } from './MapOptions'

const EmbeddingMap = lazy(() => import('../EmbeddingMap').then((m) => ({ default: m.EmbeddingMap })))
const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" />
  </div>
)

/**
 * Part 3. Students: the decisions (how to cut, what label, top-k, threshold), a split preview and the build.
 * Tech: the embedder, what is stored, the last build in detail, and the vector map with its display options.
 */
export function VectorsPart() {
  const view = useStore((s) => s.settings.view)
  const tx = useT().lab.vectors
  return (
    <div data-testid="part-vectors" data-view={view}>
      {view === 'students' ? (
        <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-5">
          <SectionCard as="h2" icon={<Hammer />} title={tx.cutTitle} explain="chunking">
            <ChunkSettings />
          </SectionCard>
          <RetrievalDecisions />
          <SplitPreview />
          <BuildControls />
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-5">
            <Embedder />
            <IndexOverview />
            <JobSteps />
          </div>
          <div className="border-t" data-testid="vector-map">
            <MapOptions />
            <div className="h-[80vh] min-h-[32rem]">
              <Suspense fallback={<Loading />}><EmbeddingMap /></Suspense>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** The embedding model and its dimensions, as the Worker reports them (or as the stored index says). */
function Embedder() {
  const caps = useStore((s) => s.auth.session?.capabilities)
  const meta = useStore((s) => s.index.meta)
  const tx = useT().lab.vectors
  const dims = caps?.embeddingDimensions ?? meta?.dimensions
  return (
    <SectionCard icon={<Cpu />} title={tx.embedderTitle} explain="embedding" data-testid="embedder">
      <div className="grid grid-cols-2 gap-2">
        <Stat label={tx.embeddingModel} value={<Badge variant="doc">{caps?.embeddingModel ?? meta?.model ?? tx.none}</Badge>} />
        <Stat label={tx.dimensions} value={dims ? formatNumber(dims) : tx.none} />
      </div>
    </SectionCard>
  )
}
