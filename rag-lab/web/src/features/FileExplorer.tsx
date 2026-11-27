import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Building2, ChevronRight, Database, Eye, FilePen, FileText, Folder, FolderOpen, History, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCorpus } from '@/data/corpus'
import { compute } from '@/rag/compute'
import { sha256Hex } from '@/rag/hash'
import { cn, formatNumber } from '@/lib/utils'
import { useT } from '@/i18n'
import { currentBuildPlan, docText, openDocument, resetKnowledgeBase, toggleSelect } from '@/state/actions'
import { isStale } from '@/state/membership'
import { goTo } from '@/state/nav'
import { useStore, type View } from '@/state/store'
import { Alert, Explain, IconBadge, docFlag, folderColor } from './common'

/** Characters, tokens (cl100k_base, in the compute worker) and content hash of every document, for the Tech face. */
function useDocStats() {
  const { documents } = useCorpus()
  const [stats, setStats] = useState<Record<string, { tokens: number; hash: string }>>({})
  useEffect(() => {
    let live = true
    const texts = documents.map(docText)
    void Promise.all([compute.countTokens(texts), Promise.all(documents.map((d) => sha256Hex(`${d.version}\n${docText(d)}`)))]).then(([tokens, hashes]) => {
      if (live) setStats(Object.fromEntries(documents.map((d, i) => [d.id, { tokens: tokens[i], hash: hashes[i] }])))
    })
    return () => {
      live = false
    }
  }, [documents])
  return stats
}

/**
 * The company's documents. Students: a tick decides whether a document belongs to the knowledge base.
 * Tech: the same tree with each file's path, version, date, size, hash and database status.
 */
export function FileExplorer({ view = 'students' }: { view?: View }) {
  const selection = useStore((s) => s.selection)
  const indexed = useStore((s) => s.index.documents)
  const plan = useStore(currentBuildPlan)
  const { documents, folders } = useCorpus()
  const tx = useT().shell.explorer
  const td = useT().lab.data
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const sel = useMemo(() => new Set(selection), [selection])
  const indexedCount = Object.keys(indexed).length
  const students = view === 'students'
  const stats = useDocStats()

  return (
    <div data-panel="docs" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-hairline bg-subtle px-4 py-3">
        <div className="flex items-center gap-2.5">
          <IconBadge><Building2 /></IconBadge>
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold leading-tight" data-testid="data-heading">{students ? td.decision : td.tech.title}</h2>
            <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{tx.company} · {tx.subtitle(documents.length)}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {students && <Badge variant="doc">{tx.selected(selection.length)}</Badge>}
          <Badge variant="ok">
            <Database /> {tx.indexed(indexedCount)}
          </Badge>
          <Explain topic="vectorDb" className="ml-auto" />
        </div>
        {students && isStale(plan) && (
          <Alert
            tone="warn"
            title={td.staleTitle}
            className="mt-2.5"
            action={
              <Button size="xs" variant="outline" onClick={() => goTo('vectors')} data-testid="data-to-vectors">
                {td.toVectors} <ArrowRight />
              </Button>
            }
          >
            <span data-testid="data-stale">{td.stale(plan.add.length, plan.remove.length)}</span>
          </Alert>
        )}
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
                {students && <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(ids, v === true)} aria-label={tx.selectAllIn(f.name)} />}
                <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium cursor-pointer" onClick={() => setOpen({ ...open, [f.id]: !isOpen })}>
                  {isOpen ? <FolderOpen className="size-4 shrink-0" style={{ color: folderColor(f.id) }} /> : <Folder className="size-4 shrink-0" style={{ color: folderColor(f.id) }} />}
                  <span className="truncate">{f.name}</span>
                  {!students && <span className="truncate font-mono text-[11px] font-normal text-muted-foreground">{f.id}/</span>}
                  <span className="ml-auto pr-1 font-mono text-[11px] font-normal text-muted-foreground">{students && nSel ? `${nSel}/` : ''}{ids.length}</span>
                </button>
              </div>
              {isOpen && (
                <div role="group" className="ml-[18px] border-l border-hairline pl-2">
                  {docs.map((d) => {
                    const ix = indexed[d.id]
                    const flag = docFlag(d.id)
                    const reason = td.reasons[d.id]
                    const st = stats[d.id]
                    return (
                      <div key={d.id} role="treeitem" className={cn('group rounded-md px-1.5 py-[5px] transition-colors hover:bg-muted', students && sel.has(d.id) && 'bg-doc-soft')} data-doc={d.id}>
                        <div className="flex min-h-[28px] items-center gap-2">
                          {students && <Checkbox checked={sel.has(d.id)} onCheckedChange={(v) => toggleSelect([d.id], v === true)} aria-label={tx.select(d.title)} />}
                          <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer" onClick={() => openDocument(d.id)} title={d.summary}>
                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className={cn('truncate text-[13px]', d.status === 'outdated' && 'text-muted-foreground line-through decoration-muted-foreground', d.status === 'draft' && 'italic text-muted-foreground')}>{d.title}</span>
                          </button>
                          {flag && (
                            <Tooltip content={flag === 'outdated' ? tx.outdatedTooltip : flag === 'draft' ? tx.draftTooltip : td.personalDataTooltip}>
                              <span data-flag={flag}>
                                <Badge variant="warn" className="px-1.5">{flag === 'outdated' ? <History /> : flag === 'draft' ? <FilePen /> : <ShieldAlert />}</Badge>
                              </span>
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
                          </div>
                        </div>
                        {students && reason && <p className="ml-6 mt-0.5 text-[12px] leading-snug text-[var(--ink-2)]" data-testid="doc-reason">{reason}</p>}
                        {!students && (
                          <dl className="ml-5 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted-foreground" data-testid="doc-tech">
                            <dd className="text-foreground">{f.id}/{d.id}</dd>
                            <dd>{td.tech.version} {d.version}</dd>
                            <dd>{td.tech.date} {d.effectiveDate}</dd>
                            <dd>{td.tech.chars} {formatNumber(docText(d).length)}</dd>
                            <dd>{td.tech.tokens} {st ? formatNumber(st.tokens) : td.tech.counting}</dd>
                            <dd>{td.tech.hash} {st ? st.hash.slice(0, 12) : td.tech.counting}</dd>
                            <dd>{td.tech.inDb} {ix ? td.tech.inDbYes(ix.chunkCount) : td.tech.inDbNo}</dd>
                          </dl>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {students && (
        <div className="space-y-2 border-t border-hairline bg-subtle px-3 py-3">
          <p className="px-1 text-[12px] leading-snug text-[var(--ink-2)]">{td.hint}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="ghost" size="xs" className="flex-auto hover:bg-muted" onClick={() => toggleSelect(documents.map((d) => d.id), false)} disabled={selection.length === 0}>
              {tx.clearSelection}
            </Button>
            <Button variant="ghost" size="xs" className="flex-auto text-danger hover:bg-muted hover:text-danger" onClick={() => setConfirmReset(true)} disabled={indexedCount === 0}>
              <RotateCcw /> {tx.reset}
            </Button>
          </div>
        </div>
      )}

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
