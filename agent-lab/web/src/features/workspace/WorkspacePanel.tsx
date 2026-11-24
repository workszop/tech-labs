import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ListOrdered, Sparkles } from 'lucide-react'
import { useT } from '@/i18n'
import { EmptyState, IconBadge } from '../common'
import { FlowGraph } from './FlowGraph'
import { NodeDetails } from './Inspector'
import { ReplayBar, RunBar } from './RunBar'
import { Timeline } from './Timeline'
import { highlightedNode, itemsOfNode, type NodeId } from './trace'
import { reveal } from './ui'
import { useRunView } from './useRunView'

/**
 * Centre panel: the agent's execution graph on top, the timeline under it, and
 * the inspector opening under the selected timeline row (a graph node opens its
 * details above the timeline). Everything shown comes from the selected run's
 * recorded trace events.
 */
export function WorkspacePanel() {
  const tx = useT().flow
  const view = useRunView()
  const { trace, run, selected } = view
  // Without a run, system nodes still open their description and tool switches.
  const [idleNode, setIdleNode] = useState<NodeId | null>(null)

  const sel = run ? selected : idleNode ? `node:${idleNode}` : null
  const highlighted = highlightedNode(trace, sel)
  const selectedNode = sel?.startsWith('node:') ? (sel.slice(5) as NodeId) : null
  const marked = useMemo(() => new Set(selectedNode ? itemsOfNode(trace, selectedNode) : []), [trace, selectedNode])

  // A node's details open above the timeline: bring them into view.
  const details = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (selectedNode && details.current) reveal(details.current)
  }, [selectedNode])

  // One polite live region for the live run: the newest call start or result, in a short sentence.
  // The text only changes when a new tool event arrives, so it is not repeated on re-renders.
  const lastCallEvent = view.live ? [...(run?.events ?? [])].reverse().find((e) => e.type === 'tool_started' || e.type === 'tool_finished') : undefined
  const lastCall = lastCallEvent ? trace.calls.find((c) => c.callId === (lastCallEvent as { callId: string }).callId) : undefined
  const announcement = !lastCall || !lastCallEvent
    ? ''
    : lastCallEvent.type === 'tool_started'
      ? tx.live.callStarted(lastCall.name || tx.timeline.unknownTool)
      : tx.live.callFinished(lastCall.name || tx.timeline.unknownTool, lastCall.result ? (lastCall.result.ok ? tx.callStatus.ok : tx.errorCode[lastCall.result.error.code]) : '')

  const { select, following } = view
  const onNode = useCallback(
    (node: NodeId) => {
      if (!run) {
        setIdleNode((n) => (n === node || node === 'customer' || node === 'final' ? null : node))
        return
      }
      const target = node === 'customer' ? (trace.started ? 'customer' : null) : node === 'final' ? (trace.finished ? 'final' : null) : `node:${node}`
      select(target && target !== selected ? target : null)
    },
    [run, trace.started, trace.finished, select, selected],
  )
  const onRow = useCallback((id: string) => select(id === selected && !following ? null : id), [select, selected, following])

  return (
    <section data-panel="workspace" aria-label={tx.panel.title} className="relative flex h-full min-h-0 flex-col bg-background max-[1099px]:overflow-y-auto">
      <div className="shrink-0 space-y-2 border-b border-hairline bg-subtle px-3 pb-2.5 pt-3 max-[1099px]:pt-2.5">
        <div className="flex items-center gap-2.5 max-[1099px]:hidden">
          <IconBadge tone="query"><Bot /></IconBadge>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[15px] font-bold leading-tight">{tx.panel.title}</h2>
            <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{tx.panel.subtitle}</div>
          </div>
        </div>
        <RunBar view={view} />
      </div>
      <ReplayBar view={view} />
      <div className="sr-only" aria-live="polite" data-testid="live-announcer">{announcement}</div>

      <div className="relative h-[clamp(300px,48vh,460px)] shrink-0 border-b border-hairline bg-card">
        <FlowGraph trace={trace} model={run?.model ?? ''} highlighted={highlighted} onSelect={onNode} />
      </div>

      <div className="scroll-thin shrink-0 space-y-3 px-3 py-3 min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:overflow-y-auto">
        {selectedNode && selectedNode !== 'customer' && selectedNode !== 'final' && (
          <div ref={details}>
            <NodeDetails node={selectedNode} trace={trace} run={run} onSelectItem={(id) => select(id)} onClose={() => (run ? select(null) : setIdleNode(null))} />
          </div>
        )}
        {run ? (
          <section aria-label={tx.panel.timelineTitle} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">
                <ListOrdered aria-hidden="true" className="size-3.5" />
                {tx.panel.timelineTitle}
              </h3>
              <span className="text-[11.5px] text-muted-foreground">{tx.panel.timelineHint}</span>
            </div>
            <Timeline trace={trace} selected={selected} marked={marked} onSelect={onRow} following={following} />
          </section>
        ) : (
          <EmptyState icon={<Sparkles />} tone="query" title={tx.empty.title}>
            <p>{tx.empty.body}</p>
            <p className="mt-2 font-semibold text-foreground">{tx.empty.hint}</p>
          </EmptyState>
        )}
      </div>
    </section>
  )
}
