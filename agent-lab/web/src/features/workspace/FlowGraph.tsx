/**
 * The execution graph: Customer, AI Agent, the seven company systems on an arc
 * and the Final response. Every node state and edge animation comes from the
 * selected run's recorded events (`TraceView`). Nodes are buttons, so they are
 * reachable with Tab and selectable with Enter; nodes cannot be dragged.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import {
  BookText, Bot, Check, Contact, MessageSquareText, Package, PauseCircle, Receipt, ShieldCheck, Ticket, Truck, User, X, type LucideIcon,
} from 'lucide-react'
import { TOOLS, type SystemId } from '@shared/tools'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { SYSTEM_IDS, type NodeId, type NodeStatus, type TraceView } from './trace'

export const SYSTEM_ICON: Record<SystemId, LucideIcon> = {
  orders: Receipt,
  products: Package,
  warranty: ShieldCheck,
  logistics: Truck,
  crm: Contact,
  knowledge: BookText,
  tickets: Ticket,
}

// ---------------------------------------------------------------- layout (designed for a ~380 px wide graph)

const SYS_W = 176
const SYS_GAP = 68
/** The systems sit on an arc: the middle ones further right. */
const ARC = [0, 16, 26, 30, 26, 16, 0]
const SYS_X = 270
const POS: Record<NodeId, { x: number; y: number; w: number }> = {
  customer: { x: 0, y: 196, w: 88 },
  agent: { x: 114, y: 178, w: 116 },
  final: { x: 114, y: 352, w: 116 },
  ...(Object.fromEntries(SYSTEM_IDS.map((id, i) => [id, { x: SYS_X + ARC[i]!, y: i * SYS_GAP, w: SYS_W }])) as Record<SystemId, { x: number; y: number; w: number }>),
}

// React Flow draws edges in SVG with colours passed from JS: literal edulab hex (tokens in index.css).
const EDGE = {
  idle: '#C9C2B7', // --line-2
  base: '#857C69', // --line-strong
  ink: '#1C1917', // --ink
  done: '#078342', // --green-600
  error: '#C92823', // --red-600
  warn: '#625B53', // --ink-3
}

// ---------------------------------------------------------------- node look

/** Whole-contour state styles (never a coloured side): see the edulab "full contours only" rule. */
const NODE_STATE: Record<NodeStatus | 'off', string> = {
  idle: 'border border-border bg-card',
  active: 'border border-foreground bg-card wl-active',
  waiting: 'border border-foreground bg-primary text-primary-foreground',
  done: 'border-2 border-ok bg-card',
  error: 'border-2 border-danger bg-card',
  warning: 'border-2 border-[var(--yellow-600)] bg-card',
  neutral: 'border border-input bg-subtle',
  off: 'border-[1.5px] border-dashed border-input bg-subtle text-[var(--ink-2)]',
}
const PILL: Record<NodeStatus | 'off', string> = {
  idle: 'bg-muted text-foreground',
  active: 'bg-primary text-primary-foreground',
  waiting: 'bg-foreground text-[var(--yellow)]',
  done: 'bg-ok text-[var(--green-ink)]',
  error: 'bg-danger text-[var(--red-ink)]',
  warning: 'bg-primary text-primary-foreground',
  neutral: 'bg-muted text-foreground',
  off: 'bg-muted text-foreground',
}

interface NodeData extends Record<string, unknown> {
  node: NodeId
  trace: TraceView
  model: string
  selected: boolean
  onSelect: (node: NodeId) => void
}

function Pill({ tone, children }: { tone: NodeStatus | 'off'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 font-mono text-[9.5px] font-medium uppercase leading-[15px] tracking-[0.04em] [&_svg]:size-2.5', PILL[tone])}>
      {children}
    </span>
  )
}

function Shell({ data, status, width, label, children }: { data: NodeData; status: NodeStatus | 'off'; width: number; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => data.onSelect(data.node)}
      aria-pressed={data.selected}
      aria-label={label}
      data-node={data.node}
      data-state={status}
      style={{ width }}
      className={cn(
        'nodrag nopan block cursor-pointer rounded-[12px] px-2 py-1.5 text-left shadow-sm transition-colors',
        NODE_STATE[status],
        data.selected && 'outline-2 outline-offset-[3px] outline-foreground',
      )}
    >
      {children}
    </button>
  )
}

const handle = '!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-[var(--line-strong)] !opacity-0'

function SystemNode({ data }: NodeProps<Node<NodeData>>) {
  const { flow: tx, learn: learnTx } = useT()
  const sys = data.trace.systems[data.node as SystemId]
  const Icon = SYSTEM_ICON[sys.id]
  const status: NodeStatus | 'off' = sys.status === 'idle' && sys.off ? 'off' : sys.status
  const name = tx.nodes.systems[sys.id]
  const n = sys.calls.length
  const last = sys.last
  const summary =
    status === 'off'
      ? tx.state.offHint
      : status === 'active' || status === 'waiting'
        ? last?.name
        : // a neutral result (not run, result not recorded) has nothing to add to its state word
          status === 'idle' || status === 'neutral'
          ? null
          : last?.result?.summary
  const stateWord = status === 'off' ? tx.state.off : tx.state[status]
  // Some (not all) tools of this system were switched off for the run.
  const someOff = TOOLS.filter((t) => t.system === sys.id && !data.trace.enabledTools.includes(t.name)).length
  const someOffText = learnTx.tools.nodeSomeOff(someOff)
  return (
    <Shell data={data} status={status} width={SYS_W} label={`${name}: ${stateWord}${n ? `, ${tx.calls(n)}` : ''}${summary ? `. ${summary}` : ''}${status === 'idle' && someOff ? `. ${someOffText}` : ''}`}>
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
      <div className="flex h-[26px] items-center gap-1.5">
        <span aria-hidden="true" className={cn('inline-grid size-[22px] shrink-0 place-items-center rounded-md [&_svg]:size-3.5', status === 'off' ? 'bg-muted text-foreground' : 'bg-doc text-[var(--blue-ink)]')}>
          <Icon />
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 font-display text-[11.5px] font-bold leading-[13px]">{name}</span>
      </div>
      <div className="mt-1 flex h-[15px] min-w-0 items-center gap-1">
        {status === 'idle' ? (
          <span className="truncate text-[10px] leading-[15px] text-muted-foreground">{someOff ? someOffText : tx.state.idle}</span>
        ) : (
          <>
            <Pill tone={status}>
              {status === 'done' && <Check aria-hidden="true" />}
              {status === 'error' && <X aria-hidden="true" />}
              {status === 'done' ? `${n}×` : stateWord}
            </Pill>
            {status === 'error' && n > 1 && <span className="shrink-0 font-mono text-[9.5px]">{n}×</span>}
            {summary && <span className={cn('min-w-0 truncate text-[10px] leading-[15px]', status === 'active' || status === 'waiting' ? 'font-mono' : '', status === 'waiting' ? '' : 'text-[var(--ink-2)]')}>{summary}</span>}
          </>
        )}
      </div>
    </Shell>
  )
}

function AgentNode({ data }: NodeProps<Node<NodeData>>) {
  const tx = useT().flow
  const a = data.trace.agent
  const rejected = a.rejected.length
  return (
    <Shell data={data} status={a.status} width={POS.agent.w} label={`${tx.nodes.agent}: ${a.step ? tx.agent.step(a.step) : tx.agent.noStep}, ${tx.agent.phase[a.phase]}${data.model ? `, ${tx.agent.model} ${data.model}` : ''}${rejected ? `, ${tx.agent.rejected(rejected)}` : ''}`}>
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
      <Handle type="source" position={Position.Right} className={handle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={handle} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-grid size-[26px] shrink-0 place-items-center rounded-md bg-query text-[var(--grape-ink)] [&_svg]:size-4"><Bot /></span>
        <span className="font-display text-[12.5px] font-bold leading-tight">{tx.nodes.agent}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <Pill tone={a.status === 'idle' ? 'idle' : a.status}>{a.step ? tx.agent.step(a.step) : tx.agent.noStep}</Pill>
      </div>
      <div className="mt-1 text-[10px] leading-tight text-[var(--ink-2)]">{tx.agent.phase[a.phase]}</div>
      {data.model && <div className="mt-0.5 truncate font-mono text-[9px] leading-tight text-muted-foreground" title={data.model}>{data.model}</div>}
      {rejected > 0 && (
        <div className="mt-1"><Pill tone="error"><X aria-hidden="true" />{tx.agent.rejected(rejected)}</Pill></div>
      )}
    </Shell>
  )
}

function CustomerNode({ data }: NodeProps<Node<NodeData>>) {
  const tx = useT().flow
  const c = data.trace.customer
  return (
    <Shell data={data} status="idle" width={POS.customer.w} label={`${tx.nodes.customer}${c.customerId ? ` ${c.customerId}` : ''}: ${c.status === 'done' ? tx.customerNode.sent : tx.customerNode.none}`}>
      <Handle type="source" position={Position.Right} className={handle} isConnectable={false} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={handle} isConnectable={false} />
      <span aria-hidden="true" className="inline-grid size-[26px] place-items-center rounded-md bg-foreground text-[var(--yellow)] [&_svg]:size-4"><User /></span>
      <div className="mt-1 font-display text-[12.5px] font-bold leading-tight">{tx.nodes.customer}</div>
      {c.customerId && <div className="truncate font-mono text-[9.5px] leading-tight text-[var(--ink-2)]">{c.customerId}</div>}
    </Shell>
  )
}

function FinalNode({ data }: NodeProps<Node<NodeData>>) {
  const tx = useT().flow
  const f = data.trace.final
  const word = f.outcome ? tx.finalNode[f.outcome] : tx.finalNode.pending
  return (
    <Shell data={data} status={f.status} width={POS.final.w} label={`${tx.nodes.final}: ${word}`}>
      <Handle type="target" position={Position.Top} className={handle} isConnectable={false} />
      <Handle type="source" position={Position.Left} className={handle} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-grid size-[22px] shrink-0 place-items-center rounded-md bg-foreground text-[var(--yellow)] [&_svg]:size-3.5"><MessageSquareText /></span>
        <span className="font-display text-[11.5px] font-bold leading-[13px]">{tx.nodes.final}</span>
      </div>
      <div className="mt-1">
        {f.status === 'idle' ? (
          <span className="text-[10px] text-muted-foreground">{word}</span>
        ) : (
          <Pill tone={f.status}>
            {f.status === 'done' ? <Check aria-hidden="true" /> : f.status === 'error' ? <X aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
            {word}
          </Pill>
        )}
      </div>
    </Shell>
  )
}

const nodeTypes = { system: memo(SystemNode), agent: memo(AgentNode), customer: memo(CustomerNode), final: memo(FinalNode) }

// ---------------------------------------------------------------- edges

function edgeStyle(status: NodeStatus | 'off', reduced: boolean): Pick<Edge, 'animated' | 'style' | 'markerEnd'> {
  const map: Record<NodeStatus | 'off', { stroke: string; width: number; dash?: string }> = {
    idle: { stroke: EDGE.idle, width: 1.25 },
    off: { stroke: EDGE.idle, width: 1.25, dash: '3 4' },
    active: { stroke: EDGE.ink, width: 2 },
    waiting: { stroke: EDGE.ink, width: 2, dash: '2 3' },
    done: { stroke: EDGE.done, width: 1.75 },
    error: { stroke: EDGE.error, width: 1.75 },
    warning: { stroke: EDGE.warn, width: 1.5, dash: '5 3' },
    neutral: { stroke: EDGE.base, width: 1.25, dash: '5 3' },
  }
  const m = map[status]
  return {
    // Only a call in progress (an event says so) animates its edge, and never with reduced motion.
    animated: status === 'active' && !reduced,
    style: { stroke: m.stroke, strokeWidth: status === 'active' && reduced ? 2.5 : m.width, ...(m.dash ? { strokeDasharray: m.dash } : {}) },
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: m.stroke },
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = () => setReduced(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

// ---------------------------------------------------------------- graph

export interface FlowGraphProps {
  trace: TraceView
  model: string
  highlighted: NodeId | null
  onSelect: (node: NodeId) => void
}

export function FlowGraph(props: FlowGraphProps) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  )
}

function Graph({ trace, model, highlighted, onSelect }: FlowGraphProps) {
  const tx = useT().flow
  const reduced = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const rf = useReactFlow()

  const nodes: Node<NodeData>[] = useMemo(() => {
    const ids: NodeId[] = ['customer', 'agent', ...SYSTEM_IDS, 'final']
    return ids.map((id) => ({
      id,
      type: id === 'customer' || id === 'agent' || id === 'final' ? id : 'system',
      position: { x: POS[id].x, y: POS[id].y },
      draggable: false,
      selectable: false,
      focusable: false,
      data: { node: id, trace, model, selected: highlighted === id, onSelect },
    }))
  }, [trace, model, highlighted, onSelect])

  const edges: Edge[] = useMemo(() => {
    const sysEdges = SYSTEM_IDS.map((id) => {
      const s = trace.systems[id]
      return { id: `agent-${id}`, source: 'agent', target: id, ...edgeStyle(s.status === 'idle' && s.off ? 'off' : s.status, reduced) }
    })
    const started: NodeStatus = trace.started ? 'done' : 'idle'
    return [
      { id: 'customer-agent', source: 'customer', target: 'agent', ...edgeStyle(started, reduced), ...(trace.started ? { style: { stroke: EDGE.ink, strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: EDGE.ink } } : {}) },
      ...sysEdges,
      { id: 'agent-final', source: 'agent', sourceHandle: 'bottom', target: 'final', ...edgeStyle(trace.final.status, reduced) },
      { id: 'final-customer', source: 'final', target: 'customer', targetHandle: 'bottom', type: 'smoothstep', ...edgeStyle(trace.final.status, reduced) },
    ]
  }, [trace, reduced])

  // Fit the fixed layout into the panel whenever the panel changes size (resize handle, tabs, window).
  useEffect(() => {
    const el = box.current
    if (!el) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (el.clientWidth > 0 && el.clientHeight > 0) void rf.fitView({ padding: 0.06, maxZoom: 1.15 })
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [rf])

  return (
    <div ref={box} className="relative h-full w-full" role="group" aria-label={tx.panel.graphLabel} data-testid="flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.06, maxZoom: 1.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        disableKeyboardA11y
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.3}
        maxZoom={1.15}
        attributionPosition="bottom-left"
      />
    </div>
  )
}
