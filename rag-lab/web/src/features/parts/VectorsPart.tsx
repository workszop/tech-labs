import { lazy, Suspense } from 'react'
import { Cpu, Hammer, ListChecks, Loader2 } from 'lucide-react'
import { labelKey } from '@/rag/chunkHeader'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { BuildControls, ChunkSettings, IndexOverview, JobSteps } from '../IndexBuilder'
import { SectionCard, Stat } from '../common'
import { RetrievalDecisions } from './RetrievalDecisions'
import { SplitPreview } from './SplitPreview'

const EmbeddingMap = lazy(() => import('../EmbeddingMap').then((m) => ({ default: m.EmbeddingMap })))
const Loading = () => (
  <div className="flex h-40 items-center justify-center text-muted-foreground">
    <Loader2 className="size-5 animate-spin" />
  </div>
)

/**
 * Part 3. Students: the decisions (how to cut, what label, top-k, threshold), a split preview and the build.
 * Tech: the embedder, what is stored, the last build in detail, and the vector map.
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
            <Decisions />
            <Embedder />
            <IndexOverview />
            <JobSteps />
          </div>
          {/* The map's own toolbar holds its display options (mode, colour, connections, labels, reset). */}
          <div className="h-[80vh] min-h-[32rem] border-t" data-testid="vector-map">
            <Suspense fallback={<Loading />}><EmbeddingMap /></Suspense>
          </div>
        </>
      )}
    </div>
  )
}

/** Tech face: the decisions of this part, read-only (they are made in the Students face; the app never flips the view). */
function Decisions() {
  const s = useStore((st) => st.settings)
  const dict = useT().lab
  const tx = dict.vectors
  const ib = dict.indexBuilder
  const labels = labelKey({ section: s.labelSection, meta: s.labelMeta })
  return (
    <SectionCard as="h2" icon={<ListChecks />} title={dict.common.decisionsTitle} data-testid="tech-decisions">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={ib.chunkSize} value={ib.tokens(s.chunkSize)} />
        <Stat label={ib.overlap} value={ib.tokens(s.overlap)} />
        <Stat label={ib.labelsTitle} value={<span className="text-sm">{dict.chat.labelNames[labels] ?? labels}</span>} />
        <Stat label={tx.topK} value={s.topK} />
        <Stat label={tx.threshold} value={s.threshold === null ? tx.thresholdOff : s.threshold.toFixed(2)} />
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{dict.common.decidedInStudents}</p>
    </SectionCard>
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
