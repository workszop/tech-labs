import { useEffect, useMemo, useRef, useState } from 'react'
import { ListOrdered, Loader2, Map as MapIcon, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { compute } from '@/rag/compute'
import { useCorpus } from '@/data/corpus'
import { useT } from '@/i18n'
import { setSettings, setUi, useStore } from '@/state/store'
import { cn, formatFixed, formatNumber } from '@/lib/utils'
import { Alert, EmptyState, Explain, IconBadge, LearnCard, QuestionQuote, ScoreBar, folderColor } from './common'

type PlotlyModule = typeof import('plotly.js-dist-min')

// Plotly draws on canvas / SVG from JS values, where CSS variables do not resolve: literal edulab hex.
// Document palette = base, deep, light and deepest steps of the five folder tones
// (blue, green, berry, ochre, stone), every step >= 3:1 on white. Grape stays reserved for the question.
const DOC_PALETTE = [
  '#177AA8', '#078342', '#C6478B', '#9A7B00', '#625B53',
  '#105A7C', '#055F30', '#8E2F62', '#6B5500', '#44403C',
  '#1E8FC2', '#00A651', '#D56BA3', '#B08900', '#857C69',
  '#0B3F57', '#03411F', '#5F1F42', '#4A3B00',
]
const PLOT = {
  ink: '#1C1917', // --ink: outline of chunks that went into the context, hover label
  text: '#44403C', // --ink-2: axis titles, legend
  muted: '#625B53', // --ink-3: tick and point labels
  grid: '#E0DBD3', // --line
  paper: '#FFFFFF', // --paper: plot background, marker outlines
  query: '#7A5AC2', // --grape: the question diamond
  ok: '#078342', // --green-600: question-to-chunk connections
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
}

export function EmbeddingMap() {
  const chunks = useStore((s) => s.index.chunks)
  const runs = useStore((s) => s.runs)
  const activeRunId = useStore((s) => s.activeRunId)
  const settings = useStore((s) => s.settings)
  const focusDoc = useStore((s) => s.ui.mapFocusDoc)
  const folderFilter = useStore((s) => s.ui.mapFolders)
  const corpus = useCorpus()
  const dict = useT().lab
  const tx = dict.map
  const plotRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<PlotlyModule | null>(null)
  const [proj, setProj] = useState<{ points: number[][]; extra: number[][]; ratio: number[]; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const dims = settings.vizMode === '3d' ? 3 : 2
  const queryRuns = useMemo(() => Object.values(runs).filter((r) => r.vector && r.vector.length === chunks[0]?.vector.length), [runs, chunks])
  const queryKey = queryRuns.map((r) => r.id).join(',')
  const fitKey = `${chunks.map((c) => c.id).join('|')}::${dims}::${queryKey}`

  useEffect(() => {
    if (chunks.length < 3) return
    let alive = true
    setBusy(true)
    compute
      .pca(
        chunks.map((c) => c.vector),
        queryRuns.map((r) => r.vector!),
        dims,
      )
      .then((res) => alive && setProj({ points: res.points, extra: res.extra, ratio: res.explainedVarianceRatio, key: fitKey }))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  const activeRun = activeRunId ? runs[activeRunId] : null
  const activeIdx = activeRun ? queryRuns.findIndex((r) => r.id === activeRun.id) : -1

  useEffect(() => {
    if (!proj || !plotRef.current) return
    let cancelled = false
    ;(async () => {
      const Plotly = (plotlyRef.current ??= (await import('plotly.js-dist-min')).default as unknown as PlotlyModule)
      if (cancelled || !plotRef.current) return
      const is3d = dims === 3
      const groups = new Map<string, number[]>()
      chunks.forEach((c, i) => {
        if (folderFilter && !folderFilter.includes(c.folder)) return
        const key = settings.colorBy === 'folder' ? c.folder : c.docId
        groups.set(key, [...(groups.get(key) ?? []), i])
      })
      const included = new Set(activeRun?.context.included ?? [])
      const traces: Record<string, unknown>[] = []
      for (const [key, idxs] of groups) {
        const color = settings.colorBy === 'folder' ? folderColor(key) : DOC_PALETTE[Math.max(0, corpus.documents.findIndex((d) => d.id === key)) % DOC_PALETTE.length]
        const name = settings.colorBy === 'folder' ? corpus.folders.find((f) => f.id === key)?.name ?? key : corpus.docById[key]?.title ?? key
        traces.push({
          type: is3d ? 'scatter3d' : 'scatter',
          mode: settings.showLabels ? 'markers+text' : 'markers',
          name,
          x: idxs.map((i) => proj.points[i][0]),
          y: idxs.map((i) => proj.points[i][1]),
          ...(is3d ? { z: idxs.map((i) => proj.points[i][2]) } : {}),
          text: idxs.map((i) => `#${chunks[i].chunkIndex}`),
          textposition: 'top center',
          textfont: { size: 9, color: PLOT.muted, family: PLOT.mono },
          customdata: idxs.map((i) => chunks[i].id),
          hovertext: idxs.map((i) => {
            const c = chunks[i]
            const score = activeRun?.search.ranked?.find((r) => r.chunkId === c.id)?.score
            return `<b>${c.docTitle}</b><br>${c.id}${score !== undefined ? `<br>${tx.cosineToQuestion(score.toFixed(3))}` : ''}<br><i>${wrap(c.text.slice(0, 160))}…</i>`
          }),
          hoverinfo: 'text',
          marker: {
            size: idxs.map((i) => (included.has(chunks[i].id) ? (is3d ? 8 : 13) : is3d ? 5 : 9)),
            color,
            opacity: idxs.map((i) => (focusDoc && chunks[i].docId !== focusDoc ? 0.15 : 0.9)),
            line: { width: idxs.map((i) => (included.has(chunks[i].id) ? 2.5 : 1)), color: idxs.map((i) => (included.has(chunks[i].id) ? PLOT.ink : PLOT.paper)) },
          },
        })
      }
      // Query points
      if (proj.extra.length) {
        traces.push({
          type: is3d ? 'scatter3d' : 'scatter',
          mode: 'markers',
          name: tx.questions,
          x: proj.extra.map((p) => p[0]),
          y: proj.extra.map((p) => p[1]),
          ...(is3d ? { z: proj.extra.map((p) => p[2]) } : {}),
          hovertext: queryRuns.map((r) => `<b>${tx.questionHover}</b><br>${wrap(r.question)}`),
          hoverinfo: 'text',
          marker: {
            symbol: 'diamond',
            size: queryRuns.map((_, i) => (i === activeIdx ? (is3d ? 10 : 17) : is3d ? 5 : 9)),
            color: PLOT.query,
            opacity: queryRuns.map((_, i) => (i === activeIdx ? 1 : 0.35)),
            line: { width: 1.5, color: PLOT.paper },
          },
        })
      }
      // Similarity connections: question → retrieved chunks (real cosine scores in the label)
      if (settings.showConnections && activeIdx >= 0 && activeRun) {
        const q = proj.extra[activeIdx]
        const xs: (number | null)[] = []
        const ys: (number | null)[] = []
        const zs: (number | null)[] = []
        for (const id of activeRun.context.included) {
          const i = chunks.findIndex((c) => c.id === id)
          if (i < 0) continue
          xs.push(q[0], proj.points[i][0], null)
          ys.push(q[1], proj.points[i][1], null)
          zs.push(q[2] ?? 0, proj.points[i][2] ?? 0, null)
        }
        traces.push({
          type: is3d ? 'scatter3d' : 'scatter',
          mode: 'lines',
          name: tx.retrieved,
          x: xs,
          y: ys,
          ...(is3d ? { z: zs } : {}),
          hoverinfo: 'skip',
          line: { color: PLOT.ok, width: 2, dash: 'dot' },
        })
      }
      const axis = (i: number) => ({
        title: { text: tx.axis(i + 1, formatFixed(proj.ratio[i] * 100, 1)), font: { size: 11, color: PLOT.text, family: PLOT.mono } },
        zeroline: false,
        gridcolor: PLOT.grid,
        linecolor: PLOT.grid,
        tickfont: { size: 10, color: PLOT.muted, family: PLOT.mono },
        showticklabels: false,
      })
      const layout: Record<string, unknown> = {
        margin: { l: 30, r: 10, t: 10, b: 30 },
        paper_bgcolor: PLOT.paper,
        plot_bgcolor: PLOT.paper,
        hovermode: 'closest',
        dragmode: is3d ? 'orbit' : 'pan',
        legend: { orientation: 'h', y: -0.08, font: { size: 12, color: PLOT.text, family: PLOT.sans } },
        font: { family: PLOT.sans, color: PLOT.ink },
        hoverlabel: { bgcolor: PLOT.ink, bordercolor: PLOT.ink, font: { family: PLOT.sans, size: 12, color: PLOT.paper } },
        uirevision: `${revision}-${dims}`,
        ...(is3d ? { scene: { xaxis: axis(0), yaxis: axis(1), zaxis: axis(2), bgcolor: PLOT.paper } } : { xaxis: axis(0), yaxis: { ...axis(1), scaleanchor: undefined } }),
      }
      await Plotly.react(plotRef.current, traces as never, layout as never, { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toImage'] } as never)
      const el = plotRef.current as unknown as { removeAllListeners?: (e: string) => void; on: (e: string, cb: (ev: { points: { customdata?: string }[] }) => void) => void }
      el.removeAllListeners?.('plotly_click')
      el.on('plotly_click', (ev) => {
        const id = ev.points?.[0]?.customdata
        if (typeof id === 'string') setUi({ inspectChunkId: id })
      })
    })()
    return () => {
      cancelled = true
    }
  }, [proj, settings.colorBy, settings.showLabels, settings.showConnections, focusDoc, folderFilter, activeRun, activeIdx, chunks, queryRuns, dims, revision, corpus, tx])

  if (chunks.length < 3)
    return (
      <EmptyState icon={<MapIcon />} title={tx.emptyTitle}>
        {tx.emptyBody}
      </EmptyState>
    )

  const docsInIndex = [...new Set(chunks.map((c) => c.docId))]
  const folders = [...new Set(chunks.map((c) => c.folder))]
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={settings.vizMode} onValueChange={(v) => setSettings({ vizMode: v as '2d' | '3d' })}>
          <TabsList>
            <TabsTrigger value="2d">2D</TabsTrigger>
            <TabsTrigger value="3d">3D</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={settings.colorBy} onValueChange={(v) => setSettings({ colorBy: v as 'folder' | 'document' })}>
          <TabsList>
            <TabsTrigger value="folder">{tx.byDepartment}</TabsTrigger>
            <TabsTrigger value="document">{tx.byDocument}</TabsTrigger>
          </TabsList>
        </Tabs>
        <select className="h-8 max-w-48 rounded-md border border-input bg-card px-2 text-xs" value={focusDoc ?? ''} onChange={(e) => setUi({ mapFocusDoc: e.target.value || null })} aria-label={tx.highlightAria}>
          <option value="">{tx.highlightPlaceholder}</option>
          {docsInIndex.map((id) => (
            <option key={id} value={id}>{corpus.docById[id]?.title ?? id}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]"><Switch checked={settings.showConnections} onCheckedChange={(v) => setSettings({ showConnections: v })} /> {tx.connections}</label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]"><Switch checked={settings.showLabels} onCheckedChange={(v) => setSettings({ showLabels: v })} /> {tx.labels}</label>
        <Button variant="ghost" size="xs" className="hover:bg-muted" onClick={() => { setUi({ mapFocusDoc: null, mapFolders: null }); setRevision((r) => r + 1) }}>
          <RotateCcw /> {tx.reset}
        </Button>
        {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <Explain topic="pca" className="ml-auto" label={tx.howMade} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {folders.map((f) => {
          const on = !folderFilter || folderFilter.includes(f)
          return (
            <button
              key={f}
              className={cn('flex items-center gap-1.5 rounded-full border border-input px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer hover:bg-muted', on ? 'bg-card text-foreground' : 'border-dashed bg-subtle text-muted-foreground line-through')}
              onClick={() => {
                const cur = folderFilter ?? folders
                const next = on ? cur.filter((x) => x !== f) : [...cur, f]
                setUi({ mapFolders: next.length === folders.length ? null : next })
              }}
              aria-pressed={on}
            >
              <span className="size-2 rounded-full" style={{ background: folderColor(f) }} /> {corpus.folders.find((x) => x.id === f)?.name ?? f}
            </button>
          )
        })}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_15rem]">
        <div className="relative min-h-[360px] overflow-hidden rounded-xl border bg-card shadow-sm">
          <div ref={plotRef} className="absolute inset-0" data-testid="embedding-plot" />
        </div>
        <div className="scroll-thin space-y-2.5 overflow-y-auto">
          <LearnCard tone="warn">
            {tx.squeeze(formatNumber(chunks[0].vector.length), dims)}
          </LearnCard>
          {activeRun?.search.ranked ? (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-hairline bg-subtle px-3 py-2">
                <IconBadge size="sm"><ListOrdered /></IconBadge>
                <h3 className="font-display text-[13.5px] font-bold leading-tight">{tx.realScores}</h3>
              </div>
              <div className="p-3">
              <QuestionQuote className="mb-2.5 line-clamp-3 px-2.5 py-1.5 text-[12px]">{dict.common.quote(activeRun.question)}</QuestionQuote>
              {activeRun.search.ranked.slice(0, Math.max(activeRun.topK, 5)).map((r) => (
                <button key={r.chunkId} className="mb-1.5 block w-full text-left cursor-pointer" onClick={() => setUi({ inspectChunkId: r.chunkId })}>
                  <div className="truncate font-mono text-[10.5px] text-muted-foreground">{r.rank}. {r.chunkId}</div>
                  <ScoreBar score={r.score} highlight={activeRun.context.included.includes(r.chunkId)} />
                </button>
              ))}
              </div>
            </div>
          ) : (
            <p className="px-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{tx.askHint}</p>
          )}
          <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">{tx.usageHint}</p>
        </div>
      </div>
    </div>
  )
}

function wrap(s: string) {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/(.{1,60})(\s|$)/g, '$1<br>')
}
