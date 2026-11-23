import { useMemo, useState } from 'react'
import { Building2, ChevronRight, Database, Eye, FileText, Folder, FolderOpen, Hammer, History, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCorpus } from '@/data/corpus'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { buildIndex, openDocument, removeFromIndex, resetKnowledgeBase, toggleSelect } from '@/state/actions'
import { useStore } from '@/state/store'
import { Explain, IconBadge, folderColor } from './common'

export function FileExplorer() {
  const selection = useStore((s) => s.selection)
  const indexed = useStore((s) => s.index.documents)
  const job = useStore((s) => s.job)
  const authed = useStore((s) => s.auth.status === 'active')
  const { documents, folders } = useCorpus()
  const tx = useT().shell.explorer
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const sel = useMemo(() => new Set(selection), [selection])
  const indexedCount = Object.keys(indexed).length
  const running = job?.status === 'running'

  return (
    <div data-panel="docs" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-hairline bg-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
          <IconBadge><Building2 /></IconBadge>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[15px] font-bold leading-tight">{tx.company}</h2>
            <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{tx.subtitle(documents.length)}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="doc">{tx.selected(selection.length)}</Badge>
          <Badge variant="ok">
            <Database /> {tx.indexed(indexedCount)}
          </Badge>
          <Explain topic="vectorDb" className="ml-auto" />
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2" role="tree" aria-label={tx.treeLabel}>
        {folders.map((f) => {
          const docs = documents.filter((d) => d.folder === f.id)
          const ids = docs.map((d) => d.id)
          const nSel = ids.filter((id) => sel.has(id)).length
          const isOpen = open[f.id] ?? false
          const checked = nSel === 0 ? false : nSel === ids.length ? true : 'indeterminate'
          return (
            <div key={f.id} role="treeitem" aria-expanded={isOpen} className="mb-0.5" data-folder={f.id}>
              <div className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted">
                <button className="flex size-5 items-center justify-center rounded text-muted-foreground cursor-pointer" onClick={() => setOpen({ ...open, [f.id]: !isOpen })} aria-label={isOpen ? tx.collapse(f.name) : tx.expand(f.name)} data-folder-toggle={f.id}>
                  <ChevronRight className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} />
                </button>
                <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(ids, v === true)} aria-label={tx.selectAllIn(f.name)} />
                <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium cursor-pointer" onClick={() => setOpen({ ...open, [f.id]: !isOpen })}>
                  {isOpen ? <FolderOpen className="size-4 shrink-0" style={{ color: folderColor(f.id) }} /> : <Folder className="size-4 shrink-0" style={{ color: folderColor(f.id) }} />}
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto pr-1 font-mono text-[11px] font-normal text-muted-foreground">{nSel ? `${nSel}/` : ''}{ids.length}</span>
                </button>
              </div>
              {isOpen && (
                <div role="group" className="ml-[18px] border-l border-hairline pl-2">
                  {docs.map((d) => {
                    const ix = indexed[d.id]
                    return (
                      <div key={d.id} role="treeitem" className={cn('group flex min-h-[38px] items-center gap-2 rounded-md px-1.5 py-[5px] transition-colors hover:bg-muted', sel.has(d.id) && 'bg-doc-soft')} data-doc={d.id}>
                        <Checkbox checked={sel.has(d.id)} onCheckedChange={(v) => toggleSelect([d.id], v === true)} aria-label={tx.select(d.title)} />
                        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer" onClick={() => openDocument(d.id)} title={d.summary}>
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className={cn('truncate text-[13px]', d.status === 'outdated' && 'text-muted-foreground line-through decoration-muted-foreground')}>{d.title}</span>
                        </button>
                        {d.status === 'outdated' && (
                          <Tooltip content={tx.outdatedTooltip}>
                            <span><Badge variant="warn" className="px-1.5"><History /></Badge></span>
                          </Tooltip>
                        )}
                        {ix && (
                          <Tooltip content={tx.inIndexTooltip(ix.chunkCount)}>
                            <span><Badge variant="ok" className="px-1.5"><Database />{ix.chunkCount}</Badge></span>
                          </Tooltip>
                        )}
                        <div className="hidden items-center group-hover:flex group-focus-within:flex">
                          <Tooltip content={tx.preview}>
                            <Button variant="ghost" size="icon-sm" className="hover:bg-card" onClick={() => openDocument(d.id)} aria-label={tx.previewAria(d.title)}>
                              <Eye />
                            </Button>
                          </Tooltip>
                          {ix && (
                            <Tooltip content={tx.removeTooltip}>
                              <Button variant="ghost" size="icon-sm" className="hover:bg-card" onClick={() => removeFromIndex([d.id])} aria-label={tx.removeAria(d.title)}>
                                <Trash2 />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-2 border-t border-hairline bg-subtle px-3 py-3">
        <p className="px-1 text-[12px] leading-snug text-[var(--ink-2)]">
          {tx.selectNoteBefore}<b>{tx.selectNoteNot}</b>{tx.selectNoteAfter}
        </p>
        <Button variant="accent" className="w-full" disabled={selection.length === 0 || running} onClick={() => buildIndex()} data-testid="build-index">
          {running ? <Loader2 className="animate-spin" /> : <Hammer />}
          {running ? tx.building : tx.build}
          {selection.length > 0 && !running && <span className="rounded-full bg-foreground px-1.5 font-mono text-[11px] font-medium leading-[18px] text-[var(--yellow)]">{selection.length}</span>}
        </Button>
        {!authed && <p className="edu-block rounded-md bg-foreground px-2.5 py-1.5 text-[11.5px] leading-snug text-background">{tx.needActivation}</p>}
        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" size="xs" className="flex-auto hover:bg-muted" onClick={() => toggleSelect(documents.map((d) => d.id), false)} disabled={selection.length === 0}>
            {tx.clearSelection}
          </Button>
          <Button variant="ghost" size="xs" className="flex-auto text-danger hover:bg-muted hover:text-danger" onClick={() => setConfirmReset(true)} disabled={indexedCount === 0}>
            <RotateCcw /> {tx.reset}
          </Button>
        </div>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx.resetTitle}</DialogTitle>
            <DialogDescription>{tx.resetBody(indexedCount)}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 border-t border-dashed px-5 py-3">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>{tx.cancel}</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetKnowledgeBase()
                setConfirmReset(false)
              }}
            >
              <Trash2 /> {tx.deleteAll}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
