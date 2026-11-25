import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Map as MapIcon, MessageSquareText, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { compute } from '@/rag/compute'
import { cosineSimilarity } from '@/rag/similarity'
import { useCorpus } from '@/data/corpus'
import { useT } from '@/i18n'
import { setSettings, setUi, useStore } from '@/state/store'
import { cn, formatFixed } from '@/lib/utils'
import { Alert, EmptyState, Explain, QuestionQuote, folderColor } from './common'

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
  ok: '#078342', // --green-600: question-to-chunk connections, top-k ring
  danger: '#C0392B', // threshold ring
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
}

/** Inner radius of the question view: the most similar chunk sits here, so it never covers the question. */
const R_MIN = 0.2

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

  const mode = settings.vizMode
  const dims = mode === '3d' ? 3 : 2
  const dimsMatch = (v?: Float32Array) => !!v && v.length === chunks[0]?.vector.length
  const queryRuns = useMemo(() => Object.values(runs).filter((r) => dimsMatch(r.vector)), [runs, chunks]) // eslint-disable-line react-hooks/exhaustive-deps
  const queryKey = queryRuns.map((r) => r.id).join(',')
  const fitKey = `${chunks.map((c) => c.id).join('|')}::${dims}::${queryKey}`

  // The run shown on the map: the active one if it has a usable vector, otherwise the newest that has.
  const activeRun = useMemo(() => {
    const a = activeRunId ? runs[activeRunId] : null
    if (a && dimsMatch(a.vector)) return a
    return [...queryRuns].sort((x, y) => y.createdAt - x.createdAt)[0] ?? null
  }, [activeRunId, runs, queryRuns]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeIdx = activeRun ? queryRuns.findIndex((r) => r.id === activeRun.id) : -1

  // Exact cosine of every chunk to the shown question (same numbers the search used).
  const scores = useMemo(() => {
    if (!activeRun?.vector) return null
    const byId = new Map(activeRun.search.ranked?.map((r) => [r.chunkId, r.score]))
    return chunks.map((c) => byId.get(c.id) ?? cosineSimilarity(activeRun.vector!, c.vector))
  }, [activeRun, chunks])

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

  const questionView = mode === 'question'
  const canDraw = !!proj && (!questionView || (!!activeRun && !!scores))

  useEffect(() => {
    if (!canDraw || !proj || !plotRef.current) return
    let cancelled = false
    ;(async () => {
      const Plotly = (plotlyRef.current ??= (await import('plotly.js-dist-min')).default as unknown as PlotlyModule)
      if (cancelled || !plotRef.current) return
      const is3d = dims === 3
      const included = new Set(activeRun?.context.included ?? [])
      const rankOf = new Map(activeRun?.search.ranked?.map((r) => [r.chunkId, r.rank]))

      // Position of every chunk. PCA views: the projection. Question view: polar layout around the question,
      // angle = the chunk's PCA direction (keeps topics together), radius = its exact cosine distance, rescaled.
      let sMin = 0
      let sMax = 1
      const radiusOf = (s: number) => R_MIN + ((sMax - s) / Math.max(1e-6, sMax - sMin)) * (1 - R_MIN)
      let pos: number[][] = proj.points
      if (questionView && scores) {
        sMin = Math.min(...scores)
        sMax = Math.max(...scores)
        pos = proj.points.map((p, i) => {
          const a = Math.atan2(p[1], p[0])
          const r = radiusOf(scores[i])
          return [r * Math.cos(a), r * Math.sin(a)]
        })
      }

      const groups = new Map<string, number[]>()
      chunks.forEach((c, i) => {
        if (folderFilter && !folderFilter.includes(c.folder)) return
        const key = settings.colorBy === 'folder' ? c.folder : c.docId
        groups.set(key, [...(groups.get(key) ?? []), i])
      })
      const traces: Record<string, unknown>[] = []
      const shapes: Record<string, unknown>[] = []
      const annotations: Record<string, unknown>[] = []

      // Rings first, so dots and lines draw on top of them.
      if (questionView) {
        const span = sMax - sMin
        const step = span > 0.4 ? 0.1 : span > 0.15 ? 0.05 : 0.02
        const ring = (s: number, color: string, dash: string, width: number, label: string, labelColor: string) => {
          const r = radiusOf(s)
          shapes.push({ type: 'circle', xref: 'x', yref: 'y', x0: -r, y0: -r, x1: r, y1: r, line: { color, width, dash }, layer: 'below' })
          annotations.push({ x: r * Math.cos(Math.PI / 4), y: r * Math.sin(Math.PI / 4), text: label, showarrow: false, font: { size: 10, color: labelColor, family: PLOT.mono }, bgcolor: 'rgba(255,255,255,0.85)', borderpad: 1 })
        }
        for (let s = Math.ceil(sMin / step) * step; s < sMax; s += step) ring(s, PLOT.grid, 'solid', 1, tx.ringScore(formatFixed(s, 2)), PLOT.muted)
        const ranked = activeRun?.search.ranked ?? []
        const inCtx = ranked.filter((r) => included.has(r.chunkId))
        if (inCtx.length) {
          const last = inCtx[inCtx.length - 1].score
          const next = ranked[inCtx.length]?.score ?? last
          // the cut-off sits between the last chunk in the context and the first one left out
          const cut = (last + next) / 2
          const r = radiusOf(cut)
          shapes.push({ type: 'circle', xref: 'x', yref: 'y', x0: -r, y0: -r, x1: r, y1: r, line: { color: PLOT.ok, width: 2, dash: 'dash' }, fillcolor: 'rgba(7,131,66,0.06)', layer: 'below' })
          annotations.push({ x: 0, y: -r, text: tx.topkRing(activeRun!.topK), showarrow: false, yshift: -9, font: { size: 11, color: PLOT.ok, family: PLOT.mono }, bgcolor: 'rgba(255,255,255,0.9)' })
        }
        if (activeRun?.threshold != null && activeRun.threshold > sMin && activeRun.threshold < sMax) {
          ring(activeRun.threshold, PLOT.danger, 'dot', 1.5, tx.thresholdRing(formatFixed(activeRun.threshold, 2)), PLOT.danger)
        }
      }

      for (const [key, idxs] of groups) {
        const color = settings.colorBy === 'folder' ? folderColor(key) : DOC_PALETTE[Math.max(0, corpus.documents.findIndex((d) => d.id === key)) % DOC_PALETTE.length]
        const name = settings.colorBy === 'folder' ? corpus.folders.find((f) => f.id === key)?.name ?? key : corpus.docById[key]?.title ?? key
        const labelled = (i: number) => questionView && included.has(chunks[i].id)
        traces.push({
          type: is3d ? 'scatter3d' : 'scatter',
          mode: settings.showLabels || questionView ? 'markers+text' : 'markers',
          name,
          x: idxs.map((i) => pos[i][0]),
          y: idxs.map((i) => pos[i][1]),
          ...(is3d ? { z: idxs.map((i) => pos[i][2]) } : {}),
          text: idxs.map((i) => (labelled(i) ? `${rankOf.get(chunks[i].id)}` : settings.showLabels ? `#${chunks[i].chunkIndex}` : '')),
          textposition: 'top center',
          textfont: { size: questionView ? 11 : 9, color: questionView ? PLOT.ink : PLOT.muted, family: PLOT.mono },
          customdata: idxs.map((i) => chunks[i].id),
          hovertext: idxs.map((i) => {
            const c = chunks[i]
            const score = scores?.[i]
            const rank = rankOf.get(c.id)
            return `<b>${esc(c.docTitle)}</b><br>${c.id}${score !== undefined ? `<br>${tx.cosineToQuestion(score.toFixed(3))}` : ''}${rank ? ` · ${tx.rank(rank)}` : ''}<br><i>${wrap(c.text.slice(0, 160))}…</i>`
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

      // Question → retrieved chunk connections.
      const q = questionView ? [0, 0, 0] : activeIdx >= 0 ? proj.extra[activeIdx] : null
      if (settings.showConnections && q && activeRun) {
        const xs: (number | null)[] = []
        const ys: (number | null)[] = []
        const zs: (number | null)[] = []
        for (const id of activeRun.context.included) {
          const i = chunks.findIndex((c) => c.id === id)
          if (i < 0) continue
          xs.push(q[0], pos[i][0], null)
          ys.push(q[1], pos[i][1], null)
          zs.push(q[2] ?? 0, pos[i][2] ?? 0, null)
        }
        traces.push({ type: is3d ? 'scatter3d' : 'scatter', mode: 'lines', name: tx.retrieved, x: xs, y: ys, ...(is3d ? { z: zs } : {}), hoverinfo: 'skip', line: { color: PLOT.ok, width: 2, dash: 'dot' } })
      }

      // Question points: in the question view only the shown one, in the centre; in PCA views every asked question.
      if (questionView && activeRun) {
        traces.push({
          type: 'scatter',
          mode: 'markers+text',
          name: tx.you,
          x: [0],
          y: [0],
          text: [tx.you],
          textposition: 'top center',
          textfont: { size: 12, color: PLOT.query, family: PLOT.sans },
          hovertext: [`<b>${tx.questionHover}</b><br>${wrap(activeRun.question)}`],
          hoverinfo: 'text',
          marker: { symbol: 'diamond', size: 22, color: PLOT.query, line: { width: 2, color: PLOT.paper } },
        })
      } else if (proj.extra.length) {
        traces.push({
          type: is3d ? 'scatter3d' : 'scatter',
          mode: 'markers+text',
          name: tx.questions,
          x: proj.extra.map((p) => p[0]),
          y: proj.extra.map((p) => p[1]),
          ...(is3d ? { z: proj.extra.map((p) => p[2]) } : {}),
          text: queryRuns.map((_, i) => (i === activeIdx ? tx.you : '')),
          textposition: 'top center',
          textfont: { size: 12, color: PLOT.query, family: PLOT.sans },
          hovertext: queryRuns.map((r) => `<b>${tx.questionHover}</b><br>${wrap(r.question)}`),
          hoverinfo: 'text',
          marker: {
            symbol: 'diamond',
            size: queryRuns.map((_, i) => (i === activeIdx ? (is3d ? 11 : 20) : is3d ? 5 : 9)),
            color: PLOT.query,
            opacity: queryRuns.map((_, i) => (i === activeIdx ? 1 : 0.35)),
            line: { width: 2, color: PLOT.paper },
          },
        })
      }

      const axis = (i: number) => ({
        title: questionView ? undefined : { text: tx.axis(i + 1, formatFixed(proj.ratio[i] * 100, 1)), font: { size: 11, color: PLOT.text, family: PLOT.mono } },
        zeroline: false,
        showgrid: !questionView,
        gridcolor: PLOT.grid,
        linecolor: PLOT.grid,
        showline: !questionView,
        tickfont: { size: 10, color: PLOT.muted, family: PLOT.mono },
        showticklabels: false,
      })
      const layout: Record<string, unknown> = {
        margin: { l: questionView ? 10 : 30, r: 10, t: 10, b: questionView ? 30 : 40 },
        paper_bgcolor: PLOT.paper,
        plot_bgcolor: PLOT.paper,
        hovermode: 'closest',
        dragmode: is3d ? 'orbit' : 'pan',
        legend: { orientation: 'h', y: questionView ? -0.04 : -0.12, font: { size: 12, color: PLOT.text, family: PLOT.sans } },
        font: { family: PLOT.sans, color: PLOT.ink },
        hoverlabel: { bgcolor: PLOT.ink, bordercolor: PLOT.ink, font: { family: PLOT.sans, size: 12, color: PLOT.paper } },
        uirevision: `${revision}-${mode}-${questionView ? activeRun?.id : ''}`,
        shapes,
        annotations,
        ...(is3d
          ? { scene: { xaxis: axis(0), yaxis: axis(1), zaxis: axis(2), bgcolor: PLOT.paper } }
          : questionView
            ? { xaxis: { ...axis(0), range: [-1.12, 1.12] }, yaxis: { ...axis(1), range: [-1.12, 1.12], scaleanchor: 'x', scaleratio: 1 } }
            : { xaxis: axis(0), yaxis: { ...axis(1), scaleanchor: undefined } }),
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
  }, [canDraw, proj, scores, questionView, mode, settings.colorBy, settings.showLabels, settings.showConnections, focusDoc, folderFilter, activeRun, activeIdx, chunks, queryRuns, dims, revision, corpus, tx])

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
        <Tabs value={mode} onValueChange={(v) => setSettings({ vizMode: v as typeof mode })}>
          <TabsList aria-label={tx.viewQuestionAria}>
            <TabsTrigger value="question" data-testid="map-view-question">{tx.viewQuestion}</TabsTrigger>
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
      {activeRun && (
        <div className="flex min-w-0 items-center gap-2 text-[12.5px]" data-testid="map-question">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{tx.shownQuestion}</span>
          <QuestionQuote className="min-w-0 truncate px-2.5 py-1 text-[12.5px]">{dict.common.quote(activeRun.question)}</QuestionQuote>
        </div>
      )}
      {questionView && !activeRun ? (
        <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm" data-testid="map-no-question">
          <MessageSquareText className="size-8 text-[var(--grape)]" />
          <h3 className="font-display text-[16px] font-bold">{tx.noQuestionTitle}</h3>
          <p className="max-w-md text-[13px] leading-relaxed text-[var(--ink-2)]">{tx.noQuestionBody}</p>
          <Button size="sm" variant="outline" onClick={() => setSettings({ vizMode: '2d' })}>{tx.showAll}</Button>
        </div>
      ) : (
        <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div ref={plotRef} className="absolute inset-0" data-testid="embedding-plot" />
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {questionView ? tx.questionCaption : tx.squeeze(chunks[0].vector.length.toLocaleString(), dims)} {tx.usageHint}
      </p>
    </div>
  )
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function wrap(s: string) {
  return esc(s).replace(/(.{1,60})(\s|$)/g, '$1<br>')
}
