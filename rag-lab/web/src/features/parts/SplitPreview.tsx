import { useState } from 'react'
import { Loader2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCorpus } from '@/data/corpus'
import { previewChunking } from '@/state/actions'
import { useStore } from '@/state/store'
import { useT } from '@/i18n'
import { Alert, ChunkText, SectionCard } from '../common'

const FIRST = 6

/**
 * Vector database, Students: "see how one document is cut". Splits one ticked document with the
 * current size, overlap and label, locally and without an access code; nothing is embedded.
 */
export function SplitPreview() {
  const selection = useStore((s) => s.selection)
  const preview = useStore((s) => s.preview)
  const build = useStore((s) => s.job)
  const { documents } = useCorpus()
  const tx = useT().lab.vectors
  const tc = useT().lab.indexBuilder.chunking
  const [picked, setPicked] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  // A preview of a single document selects that document; the guide previews PROCES-04 even when it
  // is not ticked, so the previewed document is offered next to the ticked ones.
  const previewed = preview && preview.selection.docs.length === 1 ? preview.selection.docs[0].id : null
  const offered = documents.filter((d) => selection.includes(d.id) || d.id === previewed)
  const isOffered = (id: string | null) => !!id && offered.some((d) => d.id === id)
  const docId = isOffered(picked) ? picked : isOffered(previewed) ? previewed : (offered[0]?.id ?? null)
  const doc = documents.find((d) => d.id === docId)
  // Fragments of the latest preview of this document; else those of the last build that cut it.
  const source = [preview, build].find((j) => !!docId && !!j?.selection.docs.some((d) => d.id === docId)) ?? null
  const failed = !!source && !source.chunking && source.status === 'error'
  const chunking = !!source && !source.chunking && !failed
  const chunks = source?.chunking ? source.chunking.chunks.filter((c) => c.docId === docId) : []
  const shown = showAll ? chunks : chunks.slice(0, FIRST)

  return (
    <SectionCard icon={<Scissors />} title={tx.previewTitle} explain="chunking" data-testid="split-preview">
      {offered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{tx.previewNoTicked}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 min-w-0 max-w-full flex-1 basis-56 rounded-md border border-input bg-card px-2 text-[13px]"
              value={docId ?? ''}
              onChange={(e) => {
                setPicked(e.target.value)
                setShowAll(false)
              }}
              aria-label={tx.previewDocAria}
              data-testid="split-preview-doc"
            >
              {offered.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={!docId || build?.status === 'running'} onClick={() => docId && void previewChunking([docId])} data-testid="split-preview-run">
              <Scissors /> {tx.previewRun}
            </Button>
          </div>
          <p className="text-[11.5px] text-muted-foreground">{tx.previewNote}</p>
          {chunking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {tc.loading}</div>
          )}
          {failed && source === preview && <Alert tone="danger">{preview?.error}</Alert>}
          {chunks.length > 0 && doc && (
            <div className="space-y-2" data-testid="split-preview-chunks">
              <div className="font-mono text-[11.5px] font-medium">{tx.previewCount(doc.title, chunks.length)}</div>
              {shown.map((c) => (
                <div key={c.id} className="rounded-lg border border-hairline bg-subtle p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <Badge variant="outline" className="font-mono">{tc.chunkNo(c.index + 1)}</Badge>
                    <span className="ml-auto font-mono text-muted-foreground">{tc.chunkSize(c.tokens, c.overlapPrevTokens ?? 0)}</span>
                  </div>
                  <ChunkText text={c.text} labelChars={c.labelChars} overlapPrevChars={c.overlapPrevChars} overlapNextChars={c.overlapNextChars} className="text-[var(--ink-2)]" />
                </div>
              ))}
              {chunks.length > FIRST && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                  {showAll ? tx.previewShowFewer : tx.previewShowAll(chunks.length)}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
