import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckSquare, Database, History, ShieldAlert, Square, User } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { docText, toggleSelect } from '@/state/actions'
import { useCorpus } from '@/data/corpus'
import { useT } from '@/i18n'
import { setUi, useStore } from '@/state/store'
import { FolderDot, docFlag } from './common'
import { cn } from '@/lib/utils'

export function DocumentDialog() {
  const docId = useStore((s) => s.ui.previewDocId)
  const highlight = useStore((s) => s.ui.previewHighlight)
  const selected = useStore((s) => (docId ? s.selection.includes(docId) : false))
  const allChunks = useStore((s) => s.index.chunks)
  const [showChunks, setShowChunks] = useState(false)
  const markRef = useRef<HTMLElement>(null)
  const { docById, folders } = useCorpus()
  const tx = useT().shell.documentDialog
  const td = useT().lab.data
  const doc = docId ? docById[docId] : null
  const chunks = useMemo(() => allChunks.filter((c) => c.docId === docId).sort((a, b) => a.chunkIndex - b.chunkIndex), [allChunks, docId])

  useEffect(() => {
    if (highlight) setTimeout(() => markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  }, [highlight, docId])

  if (!doc) return null
  const full = docText(doc)
  const bodyStart = 0 // offsets of chunks refer to docText(doc)

  // Build segments of the content with optional highlight / chunk boundaries.
  const segments: { text: string; kind: 'plain' | 'hit'; chunk?: number }[] = []
  if (showChunks && chunks.length) {
    let pos = bodyStart
    chunks.forEach((c, i) => {
      const s = Math.max(c.start, pos)
      if (s > pos) segments.push({ text: full.slice(pos, s), kind: 'plain' })
      if (c.end > s) segments.push({ text: full.slice(s, c.end), kind: highlight?.chunkId === c.id ? 'hit' : 'plain', chunk: i })
      pos = Math.max(pos, c.end)
    })
    if (pos < full.length) segments.push({ text: full.slice(pos), kind: 'plain' })
  } else if (highlight) {
    const s = Math.max(bodyStart, highlight.start)
    segments.push({ text: full.slice(bodyStart, s), kind: 'plain' }, { text: full.slice(s, highlight.end), kind: 'hit' }, { text: full.slice(highlight.end), kind: 'plain' })
  } else segments.push({ text: full, kind: 'plain' })

  return (
    <Dialog open onOpenChange={(o) => !o && setUi({ previewDocId: null, previewHighlight: null })}>
      <DialogContent wide>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <FolderDot folder={doc.folder} /> {folders.find((f) => f.id === doc.folder)?.name ?? doc.folder}
            <span>·</span> <User className="size-3" /> {doc.owner}
            <span>·</span> {tx.version(doc.version)}
            <span>·</span> <CalendarDays className="size-3" /> {tx.effective(doc.effectiveDate)}
            {doc.status === 'outdated' && <Badge variant="warn"><History /> {tx.outdated}</Badge>}
            {doc.status === 'draft' && <Badge variant="warn"><History /> {tx.draft}</Badge>}
            {docFlag(doc.id) === 'personal-data' && <Badge variant="warn"><ShieldAlert /> {td.personalDataTooltip}</Badge>}
            {chunks.length > 0 && <Badge variant="ok"><Database /> {tx.chunksIndexed(chunks.length)}</Badge>}
          </div>
          <DialogTitle className="text-[22px]">{doc.title}</DialogTitle>
          <DialogDescription>{doc.summary}</DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button size="xs" variant={selected ? 'secondary' : 'outline'} onClick={() => toggleSelect([doc.id], !selected)} aria-pressed={selected} data-testid="dialog-membership">
              {selected ? <CheckSquare /> : <Square />} {selected ? tx.selected : tx.select}
            </Button>
            {chunks.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
                <Switch checked={showChunks} onCheckedChange={setShowChunks} /> {tx.showBoundaries}
              </label>
            )}
            {highlight && <Badge variant="ok">{tx.highlighted(highlight.chunkId)}</Badge>}
          </div>
        </DialogHeader>
        <DialogBody>
          <article className="mx-auto max-w-[68ch] whitespace-pre-wrap text-[14.5px] leading-[1.75] text-foreground">
            {segments.map((seg, i) =>
              seg.chunk !== undefined ? (
                <span key={i} className={cn('rounded-sm px-0.5', seg.kind === 'hit' ? 'mark-hit' : seg.chunk % 2 ? 'bg-doc-soft' : 'bg-query-soft')} ref={seg.kind === 'hit' ? (markRef as React.Ref<HTMLSpanElement>) : undefined}>
                  <sup className="mr-0.5 select-none font-mono text-[9px] font-semibold text-foreground">#{seg.chunk}</sup>
                  {seg.text}
                </span>
              ) : seg.kind === 'hit' ? (
                <mark key={i} ref={markRef} className="mark-hit text-inherit">{seg.text}</mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </article>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
