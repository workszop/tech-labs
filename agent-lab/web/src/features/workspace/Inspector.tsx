/**
 * Details of a selected timeline item or graph node, all taken from the
 * recorded events: arguments, the result exactly as sent to the model, errors,
 * timing, retrieved knowledge chunks, model turn text and usage.
 */
import * as React from 'react'
import { Bot, FileText, X } from 'lucide-react'
import { TOOLS, type SystemId } from '@shared/tools'
import type { KnowledgeHit } from '@/data/kb/types'
import { noticeKeyFor, type RunRecord } from '@/agent/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatMs, formatNumber } from '@/lib/utils'
import { useT } from '@/i18n'
import { openRecord, openRecordById } from '@/features/systems/recordNav'
import { Alert } from '../common'
import { SYSTEM_ICON } from './FlowGraph'
import { CallDuration, CallStatusChip, Fields, JsonBlock, Label, RecordChips, fmtDuration, recordIds, sentToModel } from './ui'
import type { CallView, ModelTurnView, NodeId, TimelineItem, TraceView } from './trace'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Label>{title}</Label>
        {hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function since(trace: TraceView, at: number): string {
  return trace.startedAt === null ? '' : formatMs(Math.max(0, at - trace.startedAt))
}

// ---------------------------------------------------------------- tool call

function ToolCallDetails({ call, trace }: { call: CallView; trace: TraceView }) {
  const tx = useT().flow
  const t = tx.inspector
  const r = call.result
  const sent = r ? sentToModel(r) : null
  const argsText = JSON.stringify(call.args)
  const SysIcon = call.system ? SYSTEM_ICON[call.system] : null
  let hits: KnowledgeHit[] | null = null
  if (call.name === 'search_service_knowledge' && sent && r?.ok) {
    try {
      const parsed = JSON.parse(sent.text)
      if (Array.isArray(parsed)) hits = parsed as KnowledgeHit[]
    } catch {
      hits = null
    }
  }
  const ids = recordIds(argsText, sent?.text ?? '')

  return (
    <div className="space-y-3" data-inspector="tool" data-call={call.callId}>
      <Fields
        rows={[
          [t.tool, <span key="t" className="break-all font-mono text-[12px] font-semibold">{call.name || tx.timeline.unknownTool}</span>],
          [
            t.system,
            call.system && SysIcon ? (
              <span key="s" className="inline-flex items-center gap-1.5"><SysIcon aria-hidden="true" className="size-3.5 text-doc" />{tx.nodes.systems[call.system]}</span>
            ) : (
              <span key="s" className="text-[var(--ink-2)]">{t.noSystem}</span>
            ),
          ],
          [t.step, tx.timeline.stepCall(call.step, call.seq)],
          [t.status, <span key="st" className="inline-flex flex-wrap items-center gap-1.5"><CallStatusChip call={call} /><Badge variant="outline">{call.readOnly ? tx.timeline.readOnly : tx.timeline.changesData}</Badge></span>],
          [
            t.timing,
            <span key="tm" className="inline-flex flex-wrap items-center gap-x-2">
              <span>{t.startedAfter(since(trace, call.startedAt))}</span>
              {r ? <span>· {t.duration}: <CallDuration call={call} /></span> : <span className="text-muted-foreground">· {t.pending}</span>}
            </span>,
          ],
        ]}
      />

      {r && !r.ok && (
        call.status === 'error' ? (
          <Alert tone="danger" title={`${t.error}: ${tx.errorCode[r.error.code]}`}><p data-testid="tool-error">{r.error.message}</p></Alert>
        ) : call.status === 'warning' ? (
          <Alert tone="warn" title={tx.errorCode[r.error.code]}><p data-testid="tool-error">{r.error.message}</p></Alert>
        ) : (
          <div className="rounded-lg border border-input bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed" role="status">
            <div className="font-display text-[14px] font-bold">{tx.errorCode[r.error.code]}</div>
            <p data-testid="tool-error">{r.error.message}</p>
          </div>
        )
      )}

      {call.confirmation && (
        <Section title={t.confirmation}>
          <Fields
            rows={[
              [t.requested, `+${since(trace, call.confirmation.requestedAt)}`],
              [t.decided, <span key="d" className="inline-flex items-center gap-1.5">
                <Badge variant={call.confirmation.state === 'approved' ? 'ok' : call.confirmation.state === 'pending' ? 'warn' : call.confirmation.state === 'rejected' ? 'warn' : 'default'}>{tx.timeline.confirmState[call.confirmation.state]}</Badge>
                {call.confirmation.resolvedAt !== undefined && <span className="font-mono text-[11px]">+{since(trace, call.confirmation.resolvedAt)}</span>}
              </span>],
            ]}
          />
        </Section>
      )}

      <Section title={t.arguments} hint={t.argumentsHint}>
        <JsonBlock text={argsText} label="JSON" testId="tool-args" />
      </Section>

      {hits && <KnowledgeChunks hits={hits} />}

      {sent && (
        <Section title={t.result} hint={t.resultHint}>
          {sent.shortened && <Alert tone="warn">{t.shortened}</Alert>}
          <JsonBlock text={sent.text} label="JSON" testId="tool-result" />
        </Section>
      )}

      {ids.length > 0 && (
        <Section title={t.records}>
          <RecordChips ids={ids} />
        </Section>
      )}
    </div>
  )
}

function KnowledgeChunks({ hits }: { hits: KnowledgeHit[] }) {
  const tx = useT()
  const t = tx.flow.inspector
  return (
    <Section title={t.chunks(hits.length)} hint={t.chunksHint}>
      <ol className="space-y-2" data-testid="knowledge-chunks">
        {hits.map((h, i) => {
          const score = Math.max(0, Math.min(1, h.score))
          return (
            <li key={h.chunkId} className="overflow-hidden rounded-lg border border-border bg-card" data-chunk={h.chunkId}>
              <div className="flex items-start gap-2 border-b border-hairline bg-subtle px-2.5 py-1.5">
                <span className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openRecord({ kind: 'document', id: h.docId })}
                    className="inline-flex max-w-full cursor-pointer items-start gap-1 rounded-[var(--r-xs)] text-left font-display text-[13px] font-bold leading-snug text-doc underline decoration-[var(--line-strong)] underline-offset-2 hover:decoration-current"
                    aria-label={t.openDoc(h.docTitle)}
                  >
                    <FileText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span>{h.docTitle}</span>
                  </button>
                  <div className="text-[12px] leading-snug text-[var(--ink-2)]">{t.section}: {h.section}</div>
                </div>
              </div>
              <div className="space-y-1.5 px-2.5 py-2">
                <div className="flex items-center gap-2" data-score={h.score}>
                  <span className="w-[86px] shrink-0 font-mono text-[10px] uppercase tracking-[0.06em]">{t.score}</span>
                  <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(score * 100).toFixed(1)}%` }} />
                  </span>
                  <span className="w-[42px] shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums">{h.score.toFixed(3)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{tx.systems.enums.authorityOne[h.authority]}</Badge>
                  <Badge variant={h.status === 'current' ? 'ok' : 'warn'}>{tx.systems.enums.docStatus[h.status]}</Badge>
                  {h.supersededBy && (
                    <button type="button" onClick={() => openRecordById(h.supersededBy!)} className="cursor-pointer font-mono text-[11px] text-doc underline decoration-[var(--line-strong)] underline-offset-2">
                      {t.supersededBy(h.supersededBy)}
                    </button>
                  )}
                </div>
                <p className="line-clamp-4 text-[12px] leading-relaxed text-[var(--ink-2)]">{h.text}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

// ---------------------------------------------------------------- model turn, customer, final

function ModelTurnDetails({ turn, trace }: { turn: ModelTurnView; trace: TraceView }) {
  const tx = useT().flow
  const t = tx.inspector
  return (
    <div className="space-y-3" data-inspector="model">
      <Fields
        rows={[
          [t.step, tx.timeline.modelTurn(turn.step)],
          [t.kind, turn.status === 'done' ? (turn.kind === 'final' ? t.kindFinal : t.kindTools) : turn.status === 'running' ? tx.timeline.modelRunning : tx.timeline.modelInterrupted],
          [t.timing, `${t.startedAfter(since(trace, turn.startedAt))}${turn.durationMs !== undefined ? ` · ${t.duration}: ${fmtDuration(turn.durationMs)}` : ''}`],
          ...(turn.usage
            ? ([[t.usage, `${t.inputTokens} ${formatNumber(turn.usage.inputTokens)} · ${t.outputTokens} ${formatNumber(turn.usage.outputTokens)}`]] as [string, React.ReactNode][])
            : []),
        ]}
      />
      {turn.forcedFinal && <Alert tone="warn">{tx.timeline.forcedFinal}</Alert>}
      {turn.status === 'done' && (
        <Section title={t.modelText}>
          {turn.text ? (
            <p className="whitespace-pre-wrap rounded-lg border border-hairline bg-card px-3 py-2 text-[13px] leading-relaxed" data-testid="model-text">{turn.text}</p>
          ) : (
            <p className="text-[12.5px] text-[var(--ink-2)]">{t.noModelText}</p>
          )}
        </Section>
      )}
      <p className="text-[11.5px] text-muted-foreground">{t.noReasoning}</p>
    </div>
  )
}

function ToolSwitches({ enabled, system }: { enabled: string[]; system?: SystemId }) {
  const t = useT().flow.inspector
  const tools = TOOLS.filter((x) => !system || x.system === system)
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tools.map((x) => {
        const on = enabled.includes(x.name)
        return (
          <li key={x.name}>
            <Badge variant={on ? 'outline' : 'default'} className={cn(!on && 'line-through decoration-1')}>
              {x.name} · {on ? t.toolOn : t.toolOff}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

function CustomerDetails({ item }: { item: Extract<TimelineItem, { kind: 'customer' }> }) {
  const t = useT().flow.inspector
  return (
    <div className="space-y-3" data-inspector="customer">
      <Fields
        rows={[
          [t.customerId, <RecordChips key="c" ids={[item.customerId]} />],
          [t.customerMessage, <p key="m" className="whitespace-pre-wrap">{item.message}</p>],
        ]}
      />
      <Section title={t.tools}>
        <ToolSwitches enabled={item.enabledTools} />
      </Section>
    </div>
  )
}

function FinalDetails({ item }: { item: Extract<TimelineItem, { kind: 'final' }> }) {
  const tx = useT()
  const t = tx.flow.inspector
  const notice = item.outcome === 'answered' ? null : tx.shell.runNotices[noticeKeyFor(item.detail, item.outcome)]
  return (
    <div className="space-y-3" data-inspector="final">
      <Fields rows={[[t.outcome, <Badge key="o" variant={item.outcome === 'answered' ? 'ok' : item.outcome === 'error' ? 'danger' : 'warn'}>{t.outcomeLabel[item.outcome]}</Badge>]]} />
      {notice && <Alert tone={item.outcome === 'error' ? 'danger' : 'warn'}>{notice}</Alert>}
      <Section title={t.answer}>
        {item.answer ? <p className="whitespace-pre-wrap rounded-lg border border-hairline bg-card px-3 py-2 text-[13px] leading-relaxed" data-testid="final-answer">{item.answer}</p> : <p className="text-[12.5px] text-[var(--ink-2)]">{t.noAnswer}</p>}
      </Section>
    </div>
  )
}

/** Inspector body of a timeline item (shown under its row). */
export function ItemDetails({ item, trace }: { item: TimelineItem; trace: TraceView }) {
  switch (item.kind) {
    case 'customer':
      return <CustomerDetails item={item} />
    case 'model':
      return <ModelTurnDetails turn={item.turn} trace={trace} />
    case 'tool':
    case 'confirm':
      return <ToolCallDetails call={item.call} trace={trace} />
    case 'final':
      return <FinalDetails item={item} />
  }
}

// ---------------------------------------------------------------- graph node

function CallList({ calls, onSelectItem }: { calls: CallView[]; onSelectItem: (id: string) => void }) {
  const tx = useT().flow
  return (
    <ol className="space-y-1.5">
      {calls.map((c) => (
        <li key={c.callId}>
          <button
            type="button"
            onClick={() => onSelectItem(`tool:${c.callId}`)}
            className="flex w-full cursor-pointer flex-col gap-0.5 rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-subtle"
            aria-label={tx.inspector.showCall(c.seq)}
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10.5px] text-muted-foreground">#{c.seq}</span>
              <span className="font-mono text-[12px] font-semibold">{c.name || tx.timeline.unknownTool}</span>
              <CallStatusChip call={c} />
              <CallDuration call={c} />
            </span>
            {c.result && <span className="text-[12px] leading-snug text-[var(--ink-2)]">{c.result.summary}</span>}
          </button>
        </li>
      ))}
    </ol>
  )
}

/** Inspector of a graph node: the system and every call made to it in this run, or the agent's totals. */
export function NodeDetails({ node, trace, run, onSelectItem, onClose }: { node: NodeId; trace: TraceView; run: RunRecord | null; onSelectItem: (id: string) => void; onClose: () => void }) {
  const tx = useT().flow
  const t = tx.inspector
  const isSystem = node !== 'agent' && node !== 'customer' && node !== 'final'
  const title = isSystem ? tx.nodes.systems[node] : tx.nodes[node]
  const Icon = isSystem ? SYSTEM_ICON[node] : Bot
  return (
    <section className="overflow-hidden rounded-xl border border-foreground bg-card shadow-sm" aria-label={title} data-inspector="node" data-node-details={node}>
      <div className="flex items-center gap-2 border-b border-hairline bg-subtle px-3 py-2">
        <span aria-hidden="true" className={cn('inline-grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4', isSystem ? 'bg-doc text-[var(--blue-ink)]' : 'bg-query text-[var(--grape-ink)]')}><Icon /></span>
        <h3 className="min-w-0 flex-1 font-display text-[15px] font-bold leading-tight">{title}</h3>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t.close}><X /></Button>
      </div>
      <div className="space-y-3 px-3 py-3">
        {isSystem ? (
          <>
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{tx.nodes.systemInfo[node]}</p>
            <Section title={t.tools}>
              <ToolSwitches enabled={trace.enabledTools} system={node} />
            </Section>
            {trace.started && (
              <Section title={t.callsTitle}>
                {trace.systems[node].calls.length ? (
                  <>
                    <p className="text-[12px] text-[var(--ink-2)]">{t.callsTo(trace.systems[node].calls.length)}</p>
                    <CallList calls={trace.systems[node].calls} onSelectItem={onSelectItem} />
                  </>
                ) : (
                  <p className="text-[12.5px] text-[var(--ink-2)]">{t.noCalls}</p>
                )}
              </Section>
            )}
          </>
        ) : (
          <>
            <Fields
              rows={[
                [t.modelName, <span key="m" className="break-all font-mono text-[12px]">{run?.model ?? '-'}</span>],
                [t.steps, String(trace.turns.length)],
                [t.totalTokens, formatNumber(trace.totalTokens)],
              ]}
            />
            {trace.agent.rejected.length > 0 && (
              <Section title={t.rejectedCalls}>
                <CallList calls={trace.agent.rejected} onSelectItem={onSelectItem} />
              </Section>
            )}
            <p className="text-[11.5px] text-muted-foreground">{t.noReasoning}</p>
          </>
        )}
      </div>
    </section>
  )
}
