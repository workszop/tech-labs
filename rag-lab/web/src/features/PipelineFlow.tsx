import { useMemo } from 'react'
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { Bot, Brain, Database, FileStack, Files, Folder, Layers, MessageCircleQuestion, MessageSquareText, Scissors, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getCorpus, useCorpus } from '@/data/corpus'
import { t, useT } from '@/i18n'
import { setUi, useStore, type AppState, type PipelineNodeId, type StageStatus } from '@/state/store'
import { EmptyState, Explain, IconBadge, QuestionQuote, SectionCard, StatusBadge, VectorPreview, folderColor, type Tone } from './common'
import { ContextSection, EmbedSection, GenerationSection, SearchSection } from './RetrievalView'
import { IndexOverview } from './IndexBuilder'

interface StageData extends Record<string, unknown> {
  label: string
  icon: React.ReactNode
  status: StageStatus
  metric?: string
  kind: 'doc' | 'query' | 'model'
  selected: boolean
}

/** Indexing stages are blue, per-question stages grape, the two models ink (yellow icon). */
const KIND_TONE: Record<StageData['kind'], Tone> = { doc: 'doc', query: 'query', model: 'ink' }

function StageNode({ data }: NodeProps<Node<StageData>>) {
  const handle = '!size-1.5 !border-0 !bg-[var(--line-strong)]'
  return (
    <div
      data-status={data.status}
      data-selected={data.selected}
      className={cn(
        'w-[136px] rounded-xl border bg-card px-2.5 py-2.5 shadow-sm transition-colors cursor-pointer hover:bg-subtle',
        // selected = ink contour with a solid yellow band around it; running = pulsing yellow band
        data.selected && 'border-foreground shadow-[0_0_0_3px_var(--yellow)]',
        data.status === 'processing' && 'rl-processing',
      )}
    >
      <Handle type="target" position={Position.Left} className={handle} />
      <Handle type="target" position={Position.Top} id="top" className={handle} />
      <div className="flex items-center gap-2">
        <IconBadge tone={KIND_TONE[data.kind]} size="sm">{data.icon}</IconBadge>
        <div className="min-w-0 flex-1 font-display text-[12.5px] font-bold leading-tight">{data.label}</div>
      </div>
      <div className="mt-1.5 flex">
        <StatusBadge status={data.status} className="px-1.5 text-[10px] leading-[14px]" />
      </div>
      {data.metric && <div className="mt-1.5 truncate rounded-[var(--r-xs)] bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{data.metric}</div>}
      <Handle type="source" position={Position.Right} className={handle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handle} />
    </div>
  )
}

// React Flow draws edges and arrowheads in SVG with colours passed from JS: literal edulab hex.
const EDGE = {
  idle: '#857C69', // --line-strong
  done: '#078342', // --green-600
  doc: '#177AA8', // --blue-600
  label: '#44403C', // --ink-2
  labelBg: '#FFFFFF', // --paper
  dots: '#C9C2B7', // --line-2
}
const EDGE_LABEL_STYLE = { fontSize: 10, fontFamily: "'Roboto Mono', ui-monospace, monospace", fill: EDGE.label }

const nodeTypes = { stage: StageNode }

/** Node labels come from the dictionary (`lab.pipeline.nodes`). */
const LAYOUT: Record<PipelineNodeId, { x: number; y: number; icon: React.ReactNode; kind: StageData['kind'] }> = {
  docs: { x: 0, y: 0, icon: <Files />, kind: 'doc' },
  selection: { x: 150, y: 0, icon: <FileStack />, kind: 'doc' },
  chunking: { x: 300, y: 0, icon: <Scissors />, kind: 'doc' },
  embedModel: { x: 450, y: 0, icon: <Brain />, kind: 'model' },
  vectorDb: { x: 600, y: 0, icon: <Database />, kind: 'doc' },
  question: { x: 0, y: 170, icon: <MessageCircleQuestion />, kind: 'query' },
  queryEmbed: { x: 150, y: 170, icon: <Sparkles />, kind: 'query' },
  search: { x: 300, y: 170, icon: <Search />, kind: 'query' },
  context: { x: 450, y: 170, icon: <Layers />, kind: 'query' },
  llm: { x: 600, y: 170, icon: <Bot />, kind: 'model' },
  answer: { x: 750, y: 170, icon: <MessageSquareText />, kind: 'query' },
}

/** Derive every node's status from real application state. Metric texts follow the current language. */
function deriveStatuses(s: AppState): Record<PipelineNodeId, { status: StageStatus; metric?: string }> {
  const job = s.job
  const run = s.activeRunId ? s.runs[s.activeRunId] : null
  const nIndexed = s.index.chunks.length
  const step = job?.step
  const order = ['selection', 'chunking', 'embedding', 'storing', 'summary']
  const reached = (x: string) => !!step && order.indexOf(step) >= order.indexOf(x)
  const jobStatus = (x: string): StageStatus => {
    if (!job) return 'waiting'
    if (!reached(x)) return 'waiting'
    if (step === x) {
      if (job.status === 'running') return 'processing'
      if (job.status === 'error') return 'error'
      if (job.status === 'cancelled') return x === 'chunking' && job.chunking ? 'completed' : 'waiting'
    }
    if (x === 'embedding' && job.embedding?.batches.some((b) => b.status === 'failed')) return 'error'
    return 'completed'
  }
  const embModelStatus = jobStatus('embedding')
  const tm = t().lab.pipeline.metrics
  const corpus = getCorpus()
  return {
    docs: { status: 'completed', metric: tm.docs(corpus.documents.length, corpus.folders.length) },
    selection: { status: job ? 'completed' : s.selection.length ? 'completed' : 'waiting', metric: tm.selected(job?.selection.docs.length ?? s.selection.length) },
    chunking: { status: jobStatus('chunking'), metric: job?.chunking ? tm.chunks(job.chunking.chunks.length) : undefined },
    embedModel: { status: embModelStatus, metric: job?.embedding ? `${job.embedding.done}/${job.embedding.total} · ${job.embedding.dimensions}d` : s.index.meta ? s.index.meta.model : undefined },
    vectorDb: { status: job && reached('storing') ? jobStatus('storing') : nIndexed ? 'completed' : 'waiting', metric: nIndexed ? tm.vectors(nIndexed) : tm.empty },
    question: { status: run ? 'completed' : 'waiting', metric: run ? tm.question(run.question.slice(0, 22)) : undefined },
    queryEmbed: { status: run?.embed.status ?? 'waiting', metric: run?.embed.dims ? `${run.embed.dims}d` : undefined },
    search: { status: run?.search.status ?? 'waiting', metric: run?.search.ranked ? tm.top(String(run.search.ranked[0]?.score.toFixed(3))) : undefined },
    context: { status: run?.context.status ?? 'waiting', metric: run?.context.included.length ? tm.chunks(run.context.included.length) : undefined },
    llm: { status: run?.generate.status ?? 'waiting', metric: run?.generate.prompt?.model },
    answer: { status: run ? (run.generate.status === 'completed' ? 'completed' : run.generate.status === 'error' ? 'error' : run.generate.answer ? 'processing' : 'waiting') : 'waiting', metric: run?.generate.usage ? tm.tokens(run.generate.usage.outputTokens) : undefined },
  }
}

const EDGES: [PipelineNodeId, PipelineNodeId, string?][] = [
  ['docs', 'selection'],
  ['selection', 'chunking'],
  ['chunking', 'embedModel'],
  ['embedModel', 'vectorDb'],
  ['question', 'queryEmbed'],
  ['queryEmbed', 'search'],
  ['search', 'context'],
  ['context', 'llm'],
  ['llm', 'answer'],
]

export function PipelineFlow() {
  // Serialise in the selector so the snapshot is a stable primitive.
  const key = useStore((s) => JSON.stringify(deriveStatuses(s)))
  const selected = useStore((s) => s.ui.pipelineNode)
  const tx = useT().lab.pipeline
  const stable = useMemo(() => JSON.parse(key) as ReturnType<typeof deriveStatuses>, [key])

  const nodes: Node<StageData>[] = useMemo(
    () =>
      (Object.keys(LAYOUT) as PipelineNodeId[]).map((id) => ({
        id,
        type: 'stage',
        position: { x: LAYOUT[id].x, y: LAYOUT[id].y },
        draggable: false,
        data: { label: tx.nodes[id], icon: LAYOUT[id].icon, kind: LAYOUT[id].kind, status: stable[id].status, metric: stable[id].metric, selected: selected === id },
      })),
    [stable, selected, tx],
  )
  const edges: Edge[] = useMemo(() => {
    const active = (id: PipelineNodeId) => stable[id].status === 'processing'
    const base = EDGES.map(([a, b]) => {
      const stroke = stable[b].status === 'completed' ? EDGE.done : EDGE.idle
      return {
        id: `${a}-${b}`,
        source: a,
        target: b,
        animated: active(b) || active(a),
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
        style: { strokeWidth: 1.5, stroke },
      }
    })
    return [
      ...base,
      { id: 'db-search', source: 'vectorDb', target: 'search', sourceHandle: 'bottom', targetHandle: 'top', animated: active('search'), label: tx.edges.allVectors, labelStyle: EDGE_LABEL_STYLE, labelBgStyle: { fill: EDGE.labelBg }, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: EDGE.doc }, style: { strokeWidth: 1.5, stroke: EDGE.doc } },
      { id: 'model-query', source: 'embedModel', target: 'queryEmbed', sourceHandle: 'bottom', targetHandle: 'top', animated: active('queryEmbed'), label: tx.edges.sameModel, labelStyle: EDGE_LABEL_STYLE, labelBgStyle: { fill: EDGE.labelBg }, style: { strokeWidth: 1.5, strokeDasharray: '4 4', stroke: EDGE.idle } },
    ]
  }, [stable, tx])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-hairline bg-card px-4 py-2.5">
        <h2 className="font-display text-[16px] font-bold leading-tight text-foreground">{tx.title}</h2>
        <span className="text-xs text-muted-foreground">{tx.hint}</span>
        <Explain topic="rag" />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Badge variant="doc">{tx.legendIndexing}</Badge>
          <Badge variant="query">{tx.legendAnswering}</Badge>
        </div>
      </div>
      <div className="relative h-[310px] shrink-0 border-b bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: '14px' }}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, n) => setUi({ pipelineNode: n.id as PipelineNodeId })}
          minZoom={0.3}
          maxZoom={1.5}
          panOnScroll={false}
          zoomOnScroll={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} color={EDGE.dots} />
        </ReactFlow>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <StageDetails node={selected} />
      </div>
    </div>
  )
}

function StageDetails({ node }: { node: PipelineNodeId | null }) {
  const run = useStore((s) => (s.activeRunId ? s.runs[s.activeRunId] : null))
  const job = useStore((s) => s.job)
  const selection = useStore((s) => s.selection)
  const index = useStore((s) => s.index)
  const tx = useT().lab.pipeline
  const corpus = useCorpus()
  const quote = useT().lab.common.quote
  if (!node)
    return (
      <EmptyState icon={<Sparkles />} title={tx.selectTitle}>
        {tx.selectBody}
      </EmptyState>
    )
  const wrap = (title: string, topic: string | null, body: React.ReactNode) => (
    <div className="mx-auto max-w-4xl p-4">
      <SectionCard icon={LAYOUT[node].icon} tone={KIND_TONE[LAYOUT[node].kind]} title={title} explain={topic ?? undefined}>
        {body}
      </SectionCard>
    </div>
  )
  const noRun = <p className="text-sm text-muted-foreground">{tx.noRun}</p>
  switch (node) {
    case 'docs':
      return wrap(tx.details.docs, null, (
        <div className="grid gap-2 sm:grid-cols-2">
          {corpus.folders.map((f) => (
            <div key={f.id} className="rounded-lg border border-hairline bg-card p-3 text-[13px]">
              <div className="flex items-center gap-1.5 font-display text-[14px] font-bold">
                <Folder className="size-4 shrink-0" style={{ color: folderColor(f.id) }} /> {f.name}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-[var(--ink-2)]">{f.description}</div>
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">{tx.documentsCount(corpus.documents.filter((d) => d.folder === f.id).length)}</div>
            </div>
          ))}
        </div>
      ))
    case 'selection':
      return wrap(tx.details.selection, null, (
        <div className="text-[13px]">
          <p className="mb-2 text-[var(--ink-2)]">{tx.selectedNow(selection.length ? selection.map((id) => corpus.docById[id]?.title ?? id).join(', ') : tx.nothing)}</p>
          {job && <p className="text-[var(--ink-2)]">{tx.lastBuild(job.selection.docs.map((d) => d.title).join(', '))}</p>}
        </div>
      ))
    case 'chunking':
      return wrap(tx.details.chunking, 'chunking', job?.chunking ? (
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">{tx.chunkingSummary(job.chunking.chunks.length, job.config.chunkSize, job.config.overlap)}</p>
          {job.chunking.chunks.slice(0, 4).map((c) => (
            <div key={c.id} className="rounded-lg border border-hairline bg-subtle p-2.5 text-[12px]"><span className="font-mono text-[11px] text-muted-foreground">{tx.chunkMeta(c.id, c.tokens)}</span><p className="line-clamp-3 text-[var(--ink-2)]">{c.text}</p></div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setUi({ centerTab: 'build' })}>{tx.seeAllChunks}</Button>
        </div>
      ) : <p className="text-sm text-muted-foreground">{tx.noChunks}</p>)
    case 'embedModel': {
      const sample = job?.embedding?.sample ?? (index.chunks[0] ? { chunkId: index.chunks[0].id, values: Array.from(index.chunks[0].vector.slice(0, 12)) } : null)
      const dims = job?.embedding?.dimensions ?? index.meta?.dimensions
      return wrap(tx.details.embedModel, 'embedding', sample && dims ? (
        <div className="space-y-2">
          <div className="flex gap-1.5"><Badge variant="solid">{job?.embedding?.model ?? index.meta?.model}</Badge><Badge>{tx.dimensions(dims)}</Badge></div>
          <VectorPreview values={sample.values} dims={dims} label={tx.sampleLabel(sample.chunkId)} />
        </div>
      ) : <p className="text-sm text-muted-foreground">{tx.noEmbeddings}</p>)
    }
    case 'vectorDb':
      return wrap(tx.details.vectorDb, 'vectorDb', <IndexOverview compact />)
    case 'question':
      return wrap(tx.details.question, null, run ? <QuestionQuote>{quote(run.question)}</QuestionQuote> : noRun)
    case 'queryEmbed':
      return run ? <div className="mx-auto max-w-4xl p-4"><EmbedSection run={run} /></div> : wrap(tx.details.queryEmbed, 'embedding', noRun)
    case 'search':
      return run ? <div className="mx-auto max-w-4xl p-4"><SearchSection run={run} /></div> : wrap(tx.details.search, 'cosine', noRun)
    case 'context':
      return run ? <div className="mx-auto max-w-4xl p-4"><ContextSection run={run} /></div> : wrap(tx.details.context, 'context', noRun)
    case 'llm':
    case 'answer':
      return run ? <div className="mx-auto max-w-4xl p-4"><GenerationSection run={run} /></div> : wrap(node === 'llm' ? tx.details.llm : tx.details.answer, 'failures', noRun)
  }
}
