import { useMemo, useState } from 'react'
import { Boxes, Check, ChevronDown, Database, FileStack, Hammer, Loader2, Map, RefreshCw, Scissors, Sparkles, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn, formatBytes, formatMs, formatNumber } from '@/lib/utils'
import { buildIndex, cancelIndexing, currentBuildPlan, indexCompatibility, retryFailedBatches } from '@/state/actions'
import { isStale } from '@/state/membership'
import { setSettings, useStore, type IndexJob, type IndexStep, type StageStatus } from '@/state/store'
import { goTo } from '@/state/nav'
import { CHUNK_LIMITS } from '@/rag/chunker'
import { labelKey } from '@/rag/chunkHeader'
import { useT } from '@/i18n'
import { approximateIndexBytes } from '@/rag/db'
import { Alert, ChunkText, EmptyState, Explain, FolderDot, IconBadge, LearnCard, SectionCard, Stat, StatusBadge, VectorPreview, folderLabel } from './common'

/** Step titles come from the dictionary (`lab.indexBuilder.steps`). */
const STEPS: { id: IndexStep; icon: React.ReactNode }[] = [
  { id: 'selection', icon: <FileStack /> },
  { id: 'chunking', icon: <Scissors /> },
  { id: 'embedding', icon: <Sparkles /> },
  { id: 'storing', icon: <Database /> },
  { id: 'summary', icon: <Boxes /> },
]

function stepStatus(job: IndexJob, step: IndexStep): StageStatus {
  const order = STEPS.map((s) => s.id)
  const cur = order.indexOf(job.step)
  const me = order.indexOf(step)
  if (me < cur) return step === 'embedding' && job.embedding?.batches.some((b) => b.status === 'failed') ? 'error' : 'completed'
  if (me > cur) return 'waiting'
  if (job.status === 'running') return 'processing'
  if (job.status === 'error' || job.status === 'partial') return step === 'summary' ? 'completed' : 'error'
  if (job.status === 'cancelled') return step === 'chunking' && job.chunking ? 'completed' : 'waiting'
  return 'completed'
}

export function ChunkSettings({ compact }: { compact?: boolean }) {
  const settings = useStore((s) => s.settings)
  const meta = useStore((s) => s.index.meta)
  const maxOverlap = Math.floor(settings.chunkSize * CHUNK_LIMITS.maxOverlapRatio)
  const differs = meta && (meta.chunkSize !== settings.chunkSize || meta.overlap !== settings.overlap)
  const labelsDiffer = meta && !differs && (meta.labels ?? 'none') !== labelKey({ section: settings.labelSection, meta: settings.labelMeta })
  const tx = useT().lab.indexBuilder
  return (
    <div className={cn('grid gap-4', !compact && 'sm:grid-cols-2')}>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.chunkSize} <Explain topic="chunking" /></span>
          <span className="font-mono text-xs">{tx.tokens(settings.chunkSize)}</span>
        </div>
        <Slider min={CHUNK_LIMITS.minSize} max={CHUNK_LIMITS.maxSize} step={20} value={[settings.chunkSize]} onValueChange={([v]) => setSettings({ chunkSize: v, overlap: Math.min(settings.overlap, Math.floor(v * CHUNK_LIMITS.maxOverlapRatio)) })} aria-label={tx.chunkSizeAria} />
        <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.wordsPerChunk(Math.round(settings.chunkSize * 0.75))}</div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.overlap} <Explain topic="chunking" /></span>
          <span className="font-mono text-xs">{tx.tokens(settings.overlap)}</span>
        </div>
        <Slider min={0} max={maxOverlap} step={10} value={[settings.overlap]} onValueChange={([v]) => setSettings({ overlap: v })} aria-label={tx.overlapAria} />
        <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.overlapHint}</div>
      </div>
      <div className={cn('space-y-2 border-t border-dashed pt-3', !compact && 'sm:col-span-2')} data-testid="chunk-label-settings">
        <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.labelsTitle} <Explain topic="chunking" /></span>
        <div className={cn('grid gap-2', !compact && 'sm:grid-cols-2')}>
          <label className="flex items-start gap-2.5 text-[12.5px] leading-snug">
            <Switch checked={settings.labelSection} onCheckedChange={(v) => setSettings({ labelSection: v })} aria-label={tx.labelSection} className="mt-0.5 shrink-0" />
            <span><span className="font-medium">{tx.labelSection}</span><br /><span className="text-muted-foreground">{tx.labelSectionHint}</span></span>
          </label>
          <label className="flex items-start gap-2.5 text-[12.5px] leading-snug">
            <Switch checked={settings.labelMeta} onCheckedChange={(v) => setSettings({ labelMeta: v })} aria-label={tx.labelMeta} className="mt-0.5 shrink-0" />
            <span><span className="font-medium">{tx.labelMeta}</span><br /><span className="text-muted-foreground">{tx.labelMetaHint}</span></span>
          </label>
        </div>
      </div>
      {differs && (
        <p className={cn('edu-block rounded-md bg-primary px-2.5 py-1.5 text-[12px] leading-snug text-primary-foreground', !compact && 'sm:col-span-2')}>
          {tx.settingsDiffer(meta!.chunkSize, meta!.overlap)}
        </p>
      )}
      {labelsDiffer && (
        <p className={cn('edu-block rounded-md bg-primary px-2.5 py-1.5 text-[12px] leading-snug text-primary-foreground', !compact && 'sm:col-span-2')}>
          {tx.labelsDiffer}
        </p>
      )}
    </div>
  )
}

/**
 * Vector database, Students: the one build button, its progress, the result in one line and the
 * notice when the ticks or the split settings no longer match the database.
 */
export function BuildControls() {
  const job = useStore((s) => s.job)
  const selection = useStore((s) => s.selection)
  const authed = useStore((s) => s.auth.status === 'active')
  const chunks = useStore((s) => s.index.chunks.length)
  const docs = useStore((s) => Object.keys(s.index.documents).length)
  const plan = useStore(currentBuildPlan)
  const stale = isStale(plan)
  // Removing documents is local; adding or re-splitting needs embeddings, so an access code.
  const needsEmbeddings = plan.add.length > 0 || plan.resplit.length > 0
  const tx = useT().lab.indexBuilder
  const tv = useT().lab.vectors
  const td = useT().lab.data
  const running = job?.status === 'running'
  const e = job?.embedding
  return (
    <SectionCard
      as="h2"
      icon={<Hammer />}
      title={tv.buildTitle}
      explain="rag"
      data-testid="build-controls"
      foot={
        <>
          {selection.length === 0 && !stale && <p className="min-w-0 flex-1 basis-48 text-[12.5px] text-muted-foreground">{tx.selectHint}</p>}
          {/* Without an access code the button is disabled: say why. */}
          {needsEmbeddings && !authed && <p className="min-w-0 flex-1 basis-48 text-[12.5px] text-muted-foreground" data-testid="build-needs-code">{tx.embedding.needSession}</p>}
          <div className="ml-auto flex flex-wrap gap-2">
            {running && (
              <Button variant="outline" size="sm" onClick={cancelIndexing}>
                <X /> {tx.embedding.cancel}
              </Button>
            )}
            <Button variant="accent" size="sm" disabled={!stale || running || (needsEmbeddings && !authed)} onClick={() => buildIndex()} data-testid="rebuild-index">
              <Hammer /> {stale ? tx.buildPlan(plan.add.length, plan.remove.length, plan.resplit.length) : tx.upToDate}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-2.5">
        <p className="font-display text-[16px] font-bold" data-testid="vectors-result">{chunks > 0 ? tv.result(chunks, docs) : tv.empty}</p>
        {stale && (
          <Alert tone="warn" title={td.staleTitle}>
            {td.stale(plan.add.length, plan.remove.length)}
          </Alert>
        )}
        {job && running && (
          <div className="space-y-1.5" data-testid="build-progress">
            <div className="flex items-center gap-2 text-[13px]">
              <Loader2 className="size-4 animate-spin" /> {tv.building(tx.steps[job.step])}
            </div>
            {e && (
              <>
                <div className="h-2.5 overflow-hidden rounded-full bg-foreground">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((e.done / Math.max(1, e.total)) * 100)}%` }} />
                </div>
                <div className="text-[11.5px] text-muted-foreground">{tx.embedding.progress(e.done, e.total)}</div>
              </>
            )}
          </div>
        )}
        {job?.notes.map((n, i) => (
          <Alert key={i} tone="doc">{n}</Alert>
        ))}
        {job?.error && (
          <Alert
            tone={job.status === 'partial' ? 'warn' : 'danger'}
            title={job.status === 'partial' ? tx.partialTitle : tx.stoppedTitle}
            action={
              job.embedding?.batches.some((b) => b.status === 'failed' || b.status === 'pending') && authed ? (
                <Button size="xs" variant="outline" onClick={() => retryFailedBatches()}>
                  <RefreshCw /> {tx.retry}
                </Button>
              ) : undefined
            }
          >
            {job.error}
          </Alert>
        )}
      </div>
    </SectionCard>
  )
}

/** Vector database, Tech: every step of the last build with its details: chunks, batches, timings, a sample vector. */
export function JobSteps() {
  const job = useStore((s) => s.job)
  const [open, setOpen] = useState<IndexStep | 'none' | null>(null)
  const tx = useT().lab.indexBuilder
  const tv = useT().lab.vectors
  if (!job)
    return (
      <SectionCard icon={<FileStack />} title={tv.lastJobTitle}>
        <p className="text-[13px] text-muted-foreground">{tv.noJob}</p>
      </SectionCard>
    )
  return (
    <div className="space-y-3" data-testid="job-steps">
      <h3 className="font-display text-[15px] font-bold">{tv.lastJobTitle}</h3>
      {job.notes.map((n, i) => (
        <Alert key={i} tone="doc">{n}</Alert>
      ))}
      {job.error && <Alert tone={job.status === 'partial' ? 'warn' : 'danger'} title={job.status === 'partial' ? tx.partialTitle : tx.stoppedTitle}>{job.error}</Alert>}
      <ol className="space-y-2.5">
        {STEPS.map((step) => {
          const st = stepStatus(job, step.id)
          const expanded = open === step.id || (open === null && job.step === step.id)
          return (
            <li key={step.id} data-step={step.id} data-status={st} className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', st === 'processing' && 'rl-processing border-[var(--yellow)]')}>
              <button className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1.5 bg-subtle px-4 py-2.5 text-left transition-colors cursor-pointer hover:bg-muted" onClick={() => setOpen(expanded ? 'none' : step.id)} aria-expanded={expanded}>
                <IconBadge>{step.icon}</IconBadge>
                <span className="font-display text-[15px] font-bold leading-tight">{tx.steps[step.id]}</span>
                <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <StepMeta job={job} step={step.id} />
                  <StatusBadge status={st} />
                  <ChevronDown className={cn('size-4 text-foreground transition-transform', expanded && 'rotate-180')} />
                </span>
              </button>
              {expanded && <div className="border-t border-hairline px-4 py-4">{renderStep(job, step.id)}</div>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepMeta({ job, step }: { job: IndexJob; step: IndexStep }) {
  const tx = useT().lab.indexBuilder.meta
  if (step === 'selection') return <span>{tx.selection(job.selection.docs.length, formatNumber(job.selection.totalTokens))}</span>
  if (step === 'chunking' && job.chunking) return <span>{tx.chunking(job.chunking.chunks.length, formatMs(job.chunking.ms))}</span>
  if (step === 'embedding' && job.embedding) return <span>{job.embedding.done}/{job.embedding.total}</span>
  if (step === 'storing' && job.storing) return <span>{tx.stored(job.storing.storedChunks)}</span>
  return null
}

function renderStep(job: IndexJob, step: IndexStep) {
  switch (step) {
    case 'selection':
      return <SelectionStep job={job} />
    case 'chunking':
      return <ChunkingStep job={job} />
    case 'embedding':
      return <EmbeddingStep job={job} />
    case 'storing':
      return <StoringStep job={job} />
    case 'summary':
      return <IndexOverview compact />
  }
}

function SelectionStep({ job }: { job: IndexJob }) {
  const sel = job.selection
  const tx = useT().lab.indexBuilder.selection
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label={tx.documents} value={sel.docs.length} />
        <Stat label={tx.characters} value={formatNumber(sel.totalChars)} />
        <Stat label={tx.tokens} value={formatNumber(sel.totalTokens)} hint={tx.tokensHint} />
      </div>
      <ul className="divide-y divide-hairline rounded-lg border">
        {sel.docs.map((d) => (
          <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
            <FolderDot folder={d.folder} />
            <span className="min-w-0 truncate font-medium">{d.title}</span>
            <span className="shrink-0 text-muted-foreground">{folderLabel(d.folder)}</span>
            {d.reused && <Badge variant="ok">{tx.reused}</Badge>}
            <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{tx.docSize(formatNumber(d.chars), formatNumber(d.tokens))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChunkingStep({ job }: { job: IndexJob }) {
  const [filter, setFilter] = useState<string>('all')
  const [limit, setLimit] = useState(24)
  const tx = useT().lab.indexBuilder.chunking
  if (!job.chunking) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {tx.loading}</div>
  const chunks = job.chunking.chunks.filter((c) => filter === 'all' || c.docId === filter)
  const avg = Math.round(job.chunking.chunks.reduce((n, c) => n + c.tokens, 0) / Math.max(1, job.chunking.chunks.length))
  return (
    <div className="space-y-3">
      <LearnCard topic="chunking" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={tx.chunks} value={job.chunking.chunks.length} />
        <Stat label={tx.avgSize} value={tx.tok(avg)} hint={tx.target(job.config.chunkSize)} />
        <Stat label={tx.overlap} value={tx.overlapValue(job.config.overlap)} hint={tx.wholeSentences} />
        <Stat label={tx.tokenizer} value={job.chunking.tokenizer} hint={formatMs(job.chunking.ms)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{tx.show}</span>
        <select className="h-7 max-w-full rounded-md border border-input bg-card px-2 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={tx.filterAria}>
          <option value="all">{tx.allDocuments}</option>
          {job.selection.docs.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground"><mark className="mark-overlap px-1">{tx.highlighted}</mark> {tx.highlightedMeans}</span>
      </div>
      <div className="grid gap-2" data-testid="chunk-list">
        {chunks.slice(0, limit).map((c) => (
          <div key={c.id} className="rounded-lg border border-hairline bg-subtle p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <Badge variant="outline" className="font-mono" title={c.id}>{tx.chunkNo(c.index + 1)}</Badge>
              <FolderDot folder={c.folder} />
              <span className="font-medium">{c.docTitle}</span>
              <span className="ml-auto font-mono text-muted-foreground">{tx.chunkSize(c.tokens, c.overlapPrevTokens ?? 0)}</span>
            </div>
            <ChunkText text={c.text} labelChars={c.labelChars} overlapPrevChars={c.overlapPrevChars} overlapNextChars={c.overlapNextChars} className="text-[var(--ink-2)]" />
          </div>
        ))}
      </div>
      {chunks.length > limit && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit(limit + 48)}>
          {tx.showMore(chunks.length - limit)}
        </Button>
      )}
    </div>
  )
}

function EmbeddingStep({ job }: { job: IndexJob }) {
  const e = job.embedding
  const authed = useStore((s) => s.auth.status === 'active')
  const tx = useT().lab.indexBuilder.embedding
  if (!e) return <p className="text-sm text-muted-foreground">{authed ? tx.waiting : tx.needSession}</p>
  const pct = Math.round((e.done / Math.max(1, e.total)) * 100)
  return (
    <div className="space-y-3">
      <LearnCard topic="embedding" />
      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span>{tx.progress(e.done, e.total)}</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-foreground">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={tx.model} value={<span className="text-sm">{e.model}</span>} />
        <Stat label={tx.dimensions} value={formatNumber(e.dimensions)} hint={tx.dimensionsHint} />
        <Stat label={tx.fromCache} value={e.cached} hint={tx.fromCacheHint} />
        <Stat label={tx.apiUsage} value={tx.apiUsageValue(formatNumber(e.tokens))} hint={tx.apiUsageHint(e.requests, formatMs(e.ms))} />
      </div>
      {e.sample && <VectorPreview values={e.sample.values} dims={e.dimensions} label={tx.sampleLabel(e.sample.chunkId)} />}
      {e.batches.length > 0 && (
        <div>
          <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]">{tx.batches}</div>
          <div className="flex flex-wrap gap-1.5">
            {e.batches.map((b) => (
              <div key={b.index} title={b.error ?? ''} data-batch-status={b.status} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]', b.status === 'failed' ? 'border-transparent bg-danger text-white' : b.status === 'done' ? 'border-transparent bg-ok text-white' : b.status === 'running' ? 'border-transparent bg-primary text-primary-foreground' : 'border-input bg-card text-foreground')}>
                {b.status === 'running' ? <Loader2 className="size-3 animate-spin" /> : b.status === 'done' ? <Check className="size-3" strokeWidth={3} /> : b.status === 'failed' ? <X className="size-3" strokeWidth={3} /> : <Square className="size-3" />}
                {tx.batch(b.index + 1, b.chunkIds.length, b.ms ? formatMs(b.ms) : null)}
              </div>
            ))}
          </div>
        </div>
      )}
      {job.status === 'running' && (
        <Button variant="outline" size="sm" onClick={cancelIndexing}>
          <X /> {tx.cancel}
        </Button>
      )}
      <p className="text-[11.5px] text-muted-foreground">
        {tx.privacy} <Explain topic="privacy" label={tx.privacyLink} />
      </p>
    </div>
  )
}

function StoringStep({ job }: { job: IndexJob }) {
  const st = job.storing
  const persistent = useStore((s) => s.storage.persistent)
  const tx = useT().lab.indexBuilder.storing
  if (!st) return <p className="text-sm text-muted-foreground">{tx.waiting}</p>
  return (
    <div className="space-y-3">
      <LearnCard topic="vectorDb" />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={tx.chunksStored} value={st.storedChunks} />
        <Stat label={tx.documents} value={st.storedDocs} />
        <Stat label={tx.storage} value={persistent ? tx.indexedDb : tx.memoryOnly} hint={st.ms ? formatMs(st.ms) : undefined} />
      </div>
      {st.incompleteDocs.length > 0 && <Alert>{tx.notStored(st.incompleteDocs.join(', '))}</Alert>}
      <div className="rounded-lg border border-hairline bg-subtle p-3 font-mono text-[11px] leading-relaxed text-[var(--ink-2)]">
        {'{ id, docId, docTitle, folder, chunkIndex, text, start, end, tokens, vector: Float32Array(' + (job.embedding?.dimensions ?? '…') + '), model, dimensions, docHash, createdAt }'}
      </div>
    </div>
  )
}

export function IndexOverview({ compact }: { compact?: boolean }) {
  const index = useStore((s) => s.index)
  const storage = useStore((s) => s.storage)
  const usageTokens = useStore((s) => s.job?.embedding?.tokens ?? 0)
  const compat = indexCompatibility()
  const view = useStore((s) => s.settings.view)
  const [mapHint, setMapHint] = useState(false)
  const tx = useT().lab.indexBuilder.overview
  const docs = Object.values(index.documents)
  const bytes = useMemo(() => approximateIndexBytes(index.chunks), [index.chunks])
  if (!index.meta || docs.length === 0)
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <EmptyState icon={<Database />} title={tx.emptyTitle}>
          {tx.emptyBefore}<b>{tx.emptyBold}</b>{tx.emptyAfter}
        </EmptyState>
      </div>
    )
  // The map lives only in the Tech face of Vector database; the app never switches the face itself.
  const exploreMap = () => {
    goTo('vectors')
    if (view === 'students') setMapHint(true)
    else requestAnimationFrame(() => document.querySelector('[data-testid="vector-map"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const actions = (
    <>
      <Button size="sm" variant="accent" onClick={exploreMap} data-testid="explore-map">
        <Map /> {tx.exploreMap}
      </Button>
      <Button size="sm" variant="outline" onClick={() => goTo('case')}>
        {tx.ask}
      </Button>
      {mapHint && view === 'students' && <p className="basis-full text-[12px] text-muted-foreground" role="status">{tx.mapHint}</p>}
    </>
  )
  const body = (
    <div className="space-y-3">
      {!compat.ok && <Alert tone="danger" title={tx.rebuildTitle}>{compat.reason}</Alert>}
      {!storage.persistent && <Alert>{tx.noIndexedDb}</Alert>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={tx.documents} value={docs.length} />
        <Stat label={tx.chunks} value={index.chunks.length} />
        <Stat label={tx.dimensions} value={formatNumber(index.meta.dimensions)} />
        <Stat label={tx.embeddingModel} value={<span className="text-sm">{index.meta.model}</span>} />
        <Stat label={tx.localStorage} value={formatBytes(bytes)} hint={storage.bytes ? tx.siteTotal(formatBytes(storage.bytes)) : tx.approximate} />
        <Stat label={tx.chunking} value={`${index.meta.chunkSize} / ${index.meta.overlap}`} hint={usageTokens ? tx.lastBuild(formatNumber(usageTokens)) : tx.sizeOverlap} />
      </div>
      {compact && <div className="flex flex-wrap gap-2">{actions}</div>}
      <p className="text-[12px] leading-relaxed text-muted-foreground">{tx.storedNote}</p>
    </div>
  )
  if (compact) return body
  return (
    <SectionCard icon={<Database />} title={tx.current} foot={actions}>
      {body}
    </SectionCard>
  )
}
