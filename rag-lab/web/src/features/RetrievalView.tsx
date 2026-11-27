import { useMemo } from 'react'
import { Bot, ChevronRight, FileSearch, ListOrdered, MessageSquareText, Search, Sparkles, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn, formatMs, formatNumber } from '@/lib/utils'
import { openChunkInDocument, previewMessages } from '@/state/actions'
import { setSettings, setUi, useStore, type QueryRun } from '@/state/store'
import type { ChunkRecord } from '@/rag/db'
import type { ChatMessage } from '@shared/api-types'
import { useT } from '@/i18n'
import { Alert, ChunkLabelLine, EmptyState, Explain, FolderDot, docFlag, isOutdatedDoc, LearnCard, QuestionQuote, ScoreBar, SectionCard, StatusBadge, VectorPreview, type Tone } from './common'

export function RetrievalView() {
  const run = useStore((s) => (s.activeRunId ? s.runs[s.activeRunId] : null))
  const tx = useT().lab.retrieval
  if (!run)
    return (
      <EmptyState icon={<FileSearch />} title={tx.emptyTitle}>
        {tx.emptyBody}
      </EmptyState>
    )
  return <RunDetails run={run} />
}

export function RunDetails({ run }: { run: QueryRun }) {
  const dict = useT().lab
  const tx = dict.retrieval
  return (
    <div className="mx-auto max-w-4xl space-y-3 p-4 sm:p-5">
      <Section icon={<MessageSquareText />} title={tx.questionTitle} status="completed">
        <QuestionQuote>{dict.common.quote(run.question)}</QuestionQuote>
        {!run.ragEnabled && <Alert className="mt-2">{tx.ragOff}</Alert>}
      </Section>
      {run.ragEnabled && (
        <>
          <EmbedSection run={run} />
          <SearchSection run={run} />
          <ContextSection run={run} />
        </>
      )}
      <GenerationSection run={run} />
    </div>
  )
}

/** One retrieval stage as a card: stone head (grape badge = per-question stage, ink = the model), white body. */
function Section({ icon, tone = 'query', title, status, explain, right, children }: { icon: React.ReactNode; tone?: Tone; title: string; status: QueryRun['embed']['status']; explain?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <SectionCard
      icon={icon}
      tone={tone}
      title={title}
      explain={explain}
      data-status={status}
      right={
        <>
          {right}
          <StatusBadge status={status} />
        </>
      }
    >
      {children}
    </SectionCard>
  )
}

export function EmbedSection({ run }: { run: QueryRun }) {
  const e = run.embed
  const tx = useT().lab.retrieval
  return (
    <Section icon={<Sparkles />} title={tx.embedTitle} status={e.status} explain="embedding" right={e.ms ? formatMs(e.ms) : undefined}>
      {e.error && <Alert tone="danger">{e.error}</Alert>}
      {e.status === 'processing' && <p className="text-sm text-muted-foreground">{tx.embedSending}</p>}
      {e.sample && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="query">{e.model}</Badge>
            <Badge>{tx.dimensions(formatNumber(e.dims!))}</Badge>
            <Badge>{tx.tokens(e.tokens ?? 0)}</Badge>
          </div>
          <VectorPreview values={e.sample} dims={e.dims!} label={tx.questionVector} />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{tx.sameModel}</p>
        </div>
      )}
    </Section>
  )
}

export function SearchSection({ run }: { run: QueryRun }) {
  const chunks = useStore((s) => s.index.chunks)
  const showAll = useStore((s) => s.settings.showAllScores)
  const byId = useMemo(() => new Map(chunks.map((c) => [c.id, c])), [chunks])
  const s = run.search
  const tx = useT().lab.retrieval
  const included = new Set(run.context.included)
  const list = s.ranked ? (showAll ? s.ranked : s.ranked.slice(0, Math.max(run.topK + 3, 6))) : []
  return (
    <Section
      icon={<Search />}
      title={tx.searchTitle}
      status={s.status}
      explain="cosine"
      right={s.ms !== undefined ? tx.compared(s.compared ?? 0, formatMs(s.ms)) : undefined}
    >
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      {s.ranked && (
        <div className="space-y-2.5">
          <LearnCard tone="warn">
            {tx.rankingBefore}<b>{tx.rankingBold}</b>{tx.rankingAfter}
          </LearnCard>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-[var(--ink-2)]">
            <span className="flex items-center gap-1.5"><ListOrdered className="size-3.5" /> {tx.topK(run.topK, run.threshold != null ? run.threshold.toFixed(2) : null)} <Explain topic="topk" /></span>
            <label className="flex items-center gap-2">
              {tx.showAll(s.ranked.length)} <Switch checked={showAll} onCheckedChange={(v) => setSettings({ showAllScores: v })} />
            </label>
          </div>
          <ol className="divide-y divide-hairline overflow-hidden rounded-lg border" data-testid="ranked-results">
            {list.map((r) => {
              const c = byId.get(r.chunkId)
              if (!c) return null
              const hit = included.has(r.chunkId)
              return (
                <li key={r.chunkId} data-hit={hit} className="grid grid-cols-[2.25rem_1fr] gap-2 px-3 py-2">
                  <span className={cn('mt-0.5 flex size-7 items-center justify-center rounded-full font-mono text-xs font-medium', hit ? 'bg-ok text-white' : 'bg-muted text-foreground')}>{r.rank}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <FolderDot folder={c.folder} />
                      <button className="truncate font-semibold hover:underline cursor-pointer" onClick={() => setUi({ inspectChunkId: c.id })}>{c.docTitle}</button>
                      <span className="font-mono text-[11px] text-muted-foreground" title={c.id}>{tx.chunkNo(c.chunkIndex + 1)}</span>
                      {isOutdatedDoc(c.docId) && <Badge variant="warn">{docFlag(c.docId) === 'draft' ? tx.draft : tx.outdated}</Badge>}
                      {hit && <Badge variant="ok">{tx.inContext}</Badge>}
                    </div>
                    <ScoreBar score={r.score} highlight={hit} className="my-1" />
                    <p className="line-clamp-3 text-[12px] text-muted-foreground"><ChunkLabelLine label={c.labelChars ? c.text.slice(0, c.labelChars).trimEnd() : ''} />{c.labelChars ? c.text.slice(c.labelChars) : c.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
          {run.context.included.length === 0 && <Alert>{tx.noneAboveThreshold}</Alert>}
        </div>
      )}
    </Section>
  )
}

export function ContextSection({ run }: { run: QueryRun }) {
  const chunks = useStore((s) => s.index.chunks)
  const byId = useMemo(() => new Map(chunks.map((c) => [c.id, c])), [chunks])
  const inc = run.context.included.map((id) => byId.get(id)).filter(Boolean) as ChunkRecord[]
  const total = run.context.included.reduce((n, id) => n + (byId.get(id)?.tokens ?? 0), 0)
  const tx = useT().lab.retrieval
  return (
    <Section icon={<Layers />} title={tx.contextTitle} status={run.context.status} explain="context" right={inc.length ? tx.contextMeta(inc.length, total) : undefined}>
      {inc.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            {tx.included(inc.map((c, i) => `[${i + 1}] ${c.docTitle}, ${tx.chunkNo(c.chunkIndex + 1)}`).join('; '), Math.max(0, (run.search.ranked?.length ?? 0) - inc.length))}
          </p>
          {inc.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-hairline bg-subtle p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px]">
                <Badge variant="ok">[{i + 1}]</Badge>
                <span className="min-w-0 truncate font-semibold">{c.docTitle}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground" title={c.id}>{tx.chunkNo(c.chunkIndex + 1)}</span>
                {isOutdatedDoc(c.docId) && <Badge variant="warn">{docFlag(c.docId) === 'draft' ? tx.draft : tx.outdated}</Badge>}
                <button className="ml-auto shrink-0 font-medium text-doc underline underline-offset-2 cursor-pointer" onClick={() => openChunkInDocument(c.id)}>{tx.openInDocument}</button>
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ink-2)]">{c.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{run.context.status === 'waiting' ? tx.waitingSearch : tx.noContext}</p>
      )}
    </Section>
  )
}

export function GenerationSection({ run }: { run: QueryRun }) {
  const g = run.generate
  const tx = useT().lab.retrieval
  const messages: ChatMessage[] | null = g.prompt?.messages ?? (run.context.status === 'completed' ? previewMessages(run.question, run.context.included) : null)
  return (
    <Section icon={<Bot />} tone="ink" title={run.ragEnabled ? tx.generationTitle : tx.generationTitleNoRag} status={g.status} right={g.ms ? formatMs(g.ms) : undefined}>
      {g.error && <Alert tone="danger">{g.error}</Alert>}
      <div className="space-y-3">
        {g.prompt && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="solid">{g.prompt.model}</Badge>
            <Badge>{tx.temperature(g.prompt.temperature)}</Badge>
            <Badge>{tx.maxTokens(g.prompt.maxTokens)}</Badge>
            {g.usage && <Badge>{tx.usage(g.usage.inputTokens, g.usage.outputTokens)}</Badge>}
            {g.finishReason && <Badge>{tx.finish(g.finishReason)}</Badge>}
          </div>
        )}
        {messages && <PromptView messages={messages} echoed={!!g.prompt} />}
        {g.answer && (
          <div>
            <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]">{tx.modelResponse}</div>
            <div className="whitespace-pre-wrap rounded-lg border border-hairline bg-subtle p-3 text-[13.5px] leading-relaxed">{g.answer}</div>
          </div>
        )}
      </div>
    </Section>
  )
}

export function PromptView({ messages, echoed }: { messages: ChatMessage[]; echoed: boolean }) {
  const tx = useT().lab.retrieval
  return (
    <details className="group overflow-hidden rounded-lg border bg-card" open={false}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        {tx.inspectPrompt}
        <span className="font-normal text-muted-foreground">{echoed ? tx.promptExact : tx.promptPreview}</span>
      </summary>
      <div className="space-y-2 border-t border-dashed p-3">
        {messages.map((m, i) => (
          <div key={i}>
            <div className="mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-foreground">{m.role}</div>
            <pre className="scroll-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2.5 font-mono text-[11.5px] leading-relaxed text-foreground">{m.content}</pre>
          </div>
        ))}
        <Button variant="ghost" size="xs" onClick={() => navigator.clipboard?.writeText(messages.map((m) => `## ${m.role}\n${m.content}`).join('\n\n'))}>
          {tx.copyPrompt}
        </Button>
      </div>
    </details>
  )
}
