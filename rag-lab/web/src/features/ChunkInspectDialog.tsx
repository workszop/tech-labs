import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { openChunkInDocument } from '@/state/actions'
import { setUi, useStore } from '@/state/store'
import { useT } from '@/i18n'
import { ChunkText, FolderDot, ScoreBar, VectorPreview, folderLabel } from './common'

export function ChunkInspectDialog() {
  const id = useStore((s) => s.ui.inspectChunkId)
  const chunk = useStore((s) => (id ? s.index.chunks.find((c) => c.id === id) : undefined))
  const run = useStore((s) => (s.activeRunId ? s.runs[s.activeRunId] : null))
  const tx = useT().lab.chunkInspect
  if (!id || !chunk) return null
  const r = run?.search.ranked?.find((x) => x.chunkId === id)
  return (
    <Dialog open onOpenChange={(o) => !o && setUi({ inspectChunkId: null })}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <FolderDot folder={chunk.folder} /> {folderLabel(chunk.folder)} · <Badge variant="outline" className="font-mono">{chunk.id}</Badge> · {tx.chunkNo(chunk.chunkIndex + 1)} · {tx.tokens(chunk.tokens)}
          </div>
          <DialogTitle>{chunk.docTitle}</DialogTitle>
          <DialogDescription>{tx.description(chunk.start, chunk.end, chunk.model)}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {r && run && (
            <div className="rounded-lg border border-hairline bg-subtle p-3">
              <div className="mb-1 text-xs">{tx.rankBefore}<b>#{r.rank}</b>{tx.rankAfter(run.question)}{run.context.included.includes(id) && <Badge variant="ok" className="ml-2">{tx.inContext}</Badge>}</div>
              <ScoreBar score={r.score} highlight={run.context.included.includes(id)} />
            </div>
          )}
          <ChunkText text={chunk.text} overlapPrevChars={chunk.overlapPrevChars} overlapNextChars={chunk.overlapNextChars} />
          <VectorPreview values={Array.from(chunk.vector.slice(0, 16))} dims={chunk.dimensions} label={tx.storedEmbedding} />
          <Button size="sm" variant="outline" onClick={() => { setUi({ inspectChunkId: null }); openChunkInDocument(id) }}>{tx.openInDocument}</Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
