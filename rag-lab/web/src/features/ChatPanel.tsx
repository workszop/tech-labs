import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Eraser, FileSearch, Lightbulb, Loader2, MessageSquare, Square, Database, GitCompare, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { useCorpus } from '@/data/corpus'
import { useT, type Dict } from '@/i18n'
import { cn, formatMs } from '@/lib/utils'
import { ask, cancelQuery, clearConversation, indexCompatibility, openChunkInDocument, showActivation } from '@/state/actions'
import { setSettings, setUi, useStore, type GenerationResult, type QueryRun } from '@/state/store'
import { Alert, Explain, IconBadge, ScoreBar, StatusIcon } from './common'
import { PromptView } from './RetrievalView'

export function ChatPanel() {
  const chat = useStore((s) => s.chat)
  const runs = useStore((s) => s.runs)
  const settings = useStore((s) => s.settings)
  const authStatus = useStore((s) => s.auth.status)
  const caps = useStore((s) => s.auth.session?.capabilities)
  const indexEmpty = useStore((s) => s.index.chunks.length === 0)
  const tx = useT().lab.chat
  const { suggestedQuestions } = useCorpus()
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const busy = Object.values(runs).some((r) => r.generate.status === 'processing' || r.embed.status === 'processing' || r.baseline?.status === 'processing')
  const lastRun = chat.length ? runs[chat[chat.length - 1].runId] : null
  const compat = indexCompatibility()

  useEffect(() => {
    const el = scrollRef.current
    if (el && chat.length > 0) el.scrollTop = el.scrollHeight
  }, [chat.length, lastRun?.generate.answer, lastRun?.baseline?.answer])

  function send(q?: string) {
    const question = (q ?? text).trim()
    if (!question || busy) return
    setText('')
    void ask(question)
  }

  return (
    <div data-panel="chat" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-hairline bg-subtle px-4 py-3">
        <IconBadge><MessageSquare /></IconBadge>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-bold leading-tight">{tx.title}</h2>
          <div className="truncate font-mono text-[10.5px] text-muted-foreground">{caps ? tx.subtitle(caps.chatModel) : tx.activateToChat}</div>
        </div>
        <Tooltip content={tx.clear}>
          <Button variant="ghost" size="icon-sm" className="ml-auto hover:bg-muted" onClick={clearConversation} disabled={chat.length === 0} aria-label={tx.clear}>
            <Eraser />
          </Button>
        </Tooltip>
      </div>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {chat.length === 0 && (
          <div className="space-y-3">
            {indexEmpty && settings.ragEnabled ? (
              <Alert tone="doc" title={tx.buildFirstTitle}>
                {tx.buildFirstBefore}<b>{tx.buildFirstBold}</b>{tx.buildFirstAfter}
              </Alert>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{tx.intro}</p>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 pt-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-foreground"><Lightbulb className="size-3.5" /> {tx.suggested}</div>
              {suggestedQuestions.map((s) => (
                <button key={s.question} title={tx.answeredBy(s.hint)} onClick={() => send(s.question)} disabled={authStatus !== 'active' || busy} className="block w-full rounded-xl border border-input bg-card px-3.5 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 cursor-pointer">
                  {s.question}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) => {
          const run = runs[m.runId]
          if (!run) return null
          return m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-xl bg-query px-3.5 py-2 text-[13.5px] leading-snug text-white" data-testid="user-message">{run.question}</div>
            </div>
          ) : (
            <AssistantMessage key={m.id} run={run} />
          )
        })}
      </div>

      <div className="border-t border-hairline bg-subtle px-3 pb-3 pt-2.5">
        {!compat.ok && <Alert tone="danger" className="mb-2">{compat.reason}</Alert>}
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
          <label className="flex items-center gap-1.5">
            <Switch checked={settings.ragEnabled} onCheckedChange={(v) => setSettings({ ragEnabled: v })} aria-label={tx.ragAria} />
            <span className={cn('font-semibold', !settings.ragEnabled && 'rounded-full bg-primary px-2 py-0.5 text-primary-foreground')}>{tx.ragState(settings.ragEnabled)}</span>
          </label>
          <label className={cn('flex items-center gap-1.5', !settings.ragEnabled && 'text-muted-foreground')}>
            <Switch checked={settings.compareMode} disabled={!settings.ragEnabled} onCheckedChange={(v) => setSettings({ compareMode: v })} aria-label={tx.compareAria} />
            <GitCompare className="size-3.5" /> {tx.compare} <Explain topic="compare" />
          </label>
          <label className={cn('ml-auto flex items-center gap-1.5', !settings.ragEnabled && 'text-muted-foreground')}>
            {tx.topK} <Explain topic="topk" />
            <select className="h-6 rounded-md border border-input bg-card px-1 font-mono text-xs disabled:opacity-50" value={settings.topK} onChange={(e) => setSettings({ topK: Number(e.target.value) })} disabled={!settings.ragEnabled} aria-label={tx.topKAria}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
        </div>
        {authStatus !== 'active' ? (
          <Button variant="accent" className="w-full" onClick={showActivation}>{tx.enterCode}</Button>
        ) : (
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <Textarea
              rows={2}
              value={text}
              maxLength={caps?.maxQuestionChars ?? 1000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={settings.ragEnabled ? tx.placeholderRag : tx.placeholderNoRag}
              className="pr-12"
              aria-label={tx.questionAria}
              data-testid="chat-input"
            />
            {busy ? (
              <Button type="button" size="icon-sm" variant="secondary" className="absolute bottom-2 right-2" onClick={cancelQuery} aria-label={tx.stop}>
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon-sm" variant="accent" className="absolute bottom-2 right-2" disabled={!text.trim()} aria-label={tx.send}>
                <ArrowUp />
              </Button>
            )}
          </form>
        )}
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{tx.privacy} <Explain topic="privacy" /></p>
      </div>
    </div>
  )
}

function stageLine(run: QueryRun, tx: Dict['lab']['chat']['stages']) {
  if (!run.ragEnabled) return [{ label: tx.generateNoRag, status: run.generate.status }]
  return [
    { label: tx.embed, status: run.embed.status },
    { label: tx.search, status: run.search.status },
    { label: tx.context, status: run.context.status },
    { label: tx.generate, status: run.generate.status },
  ]
}

function AssistantMessage({ run }: { run: QueryRun }) {
  const showDetails = useStore((s) => s.settings.showRetrievalDetails)
  const [open, setOpen] = useState(false)
  const tx = useT().lab.chat
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
        {stageLine(run, tx.stages).map((s) => (
          <span key={s.label} className="flex items-center gap-1"><StatusIcon status={s.status} className="size-3" /> {s.label}</span>
        ))}
      </div>
      <div className={cn('grid gap-2', run.baseline && 'sm:grid-cols-1')}>
        <AnswerCard run={run} gen={run.generate} title={run.baseline ? tx.withRag : undefined} />
        {run.baseline && <AnswerCard run={run} gen={run.baseline} title={tx.withoutRag} baseline />}
      </div>
      {run.ragEnabled && run.search.ranked && showDetails && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <button className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-semibold transition-colors cursor-pointer hover:bg-muted" onClick={() => setOpen(!open)} aria-expanded={open}>
            <Database className="size-3.5 shrink-0" /> {tx.retrieved(run.context.included.length, run.search.compared ?? 0)}
            <ChevronDown className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div className="space-y-2 border-t border-dashed px-3 py-2.5">
              {run.search.ranked.slice(0, run.topK).map((r) => (
                <button key={r.chunkId} className="block w-full text-left cursor-pointer" onClick={() => setUi({ inspectChunkId: r.chunkId })}>
                  <div className="flex items-center gap-1.5 text-[11.5px]"><span className="font-semibold">#{r.rank}</span><span className="truncate font-mono text-muted-foreground">{r.chunkId}</span></div>
                  <ScoreBar score={r.score} highlight={run.context.included.includes(r.chunkId)} />
                </button>
              ))}
              <Button size="xs" variant="outline" onClick={() => setUi({ centerTab: 'retrieval', mobileTab: 'lab' })}>
                <FileSearch /> {tx.fullDetails}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Answer as a card: stone head (model name, mode badges), white body, dashed foot (usage, prompt). */
function AnswerCard({ run, gen, title, baseline }: { run: QueryRun; gen: GenerationResult; title?: string; baseline?: boolean }) {
  const chunks = useStore((s) => s.index.chunks)
  const caps = useStore((s) => s.auth.session?.capabilities)
  const cited = useMemo(() => new Set([...gen.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))), [gen.answer])
  const sources = run.context.included.map((id, i) => ({ n: i + 1, id, chunk: chunks.find((c) => c.id === id) }))
  const pending = gen.status === 'processing' && !gen.answer
  const dict = useT()
  const tx = dict.lab.chat
  const model = gen.prompt?.model ?? caps?.chatModel
  const withRag = run.ragEnabled && !baseline
  const showFoot = gen.status === 'completed' || (gen.prompt && gen.status !== 'processing')
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm" data-testid={baseline ? 'baseline-answer' : 'answer'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-hairline bg-subtle px-3 py-2">
        <IconBadge size="sm" tone={withRag ? 'ok' : 'warn'}>{withRag ? <Database /> : <Bot />}</IconBadge>
        {title ? (
          <span className="font-display text-[13.5px] font-bold leading-tight">{title}</span>
        ) : (
          model && <span className="min-w-0 truncate font-mono text-[11.5px] font-medium">{model}</span>
        )}
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {title && model && <span className="font-mono text-[10.5px] text-muted-foreground">{model}</span>}
          {!run.ragEnabled && !title && <Badge variant="warn">{tx.ragOffBadge}</Badge>}
          {caps?.provider === 'mock' && <Badge>{dict.shell.header.mockBadge}</Badge>}
        </span>
      </div>
      <div className="px-3.5 py-3">
        {pending && <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> {run.ragEnabled && !baseline ? tx.reading : tx.thinking}</div>}
        {gen.answer && <AnswerText text={gen.answer} sources={sources} baseline={baseline} />}
        {gen.error && <Alert tone="danger" className={cn(gen.answer && 'mt-2.5')}>{gen.error}</Alert>}
        {!baseline && sources.length > 0 && gen.status === 'completed' && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => openChunkInDocument(s.id)}
                data-cited={cited.has(s.n)}
                className={cn('flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors cursor-pointer', cited.has(s.n) ? 'border-transparent bg-ok text-white hover:bg-foreground' : 'border-input bg-card text-[var(--ink-2)] hover:bg-muted')}
                title={cited.has(s.n) ? tx.cited : tx.notCited}
              >
                <span className="font-mono font-medium">[{s.n}]</span> <span className="truncate">{s.chunk?.docTitle ?? s.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showFoot && (
        <div className="space-y-2 border-t border-dashed px-3.5 py-2.5">
          {gen.status === 'completed' && (
            <div className="flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-muted-foreground">
              {gen.ms !== undefined && <span>{formatMs(gen.ms)}</span>}
              {gen.usage && <span>· {tx.usage(gen.usage.inputTokens, gen.usage.outputTokens)}</span>}
            </div>
          )}
          {gen.prompt && gen.status !== 'processing' && <PromptView messages={gen.prompt.messages} echoed />}
        </div>
      )}
    </div>
  )
}

/** Render the answer with [n] citations turned into clickable chips. */
function AnswerText({ text, sources, baseline }: { text: string; sources: { n: number; id: string }[]; baseline?: boolean }) {
  const parts = text.split(/(\[\d+\])/g)
  const tx = useT().lab.chat
  return (
    <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
      {parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p)
        if (!m || baseline) return <span key={i}>{p}</span>
        const src = sources.find((s) => s.n === Number(m[1]))
        return src ? (
          <button key={i} onClick={() => openChunkInDocument(src.id)} className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-[var(--r-xs)] bg-ok px-1 align-text-top font-mono text-[10.5px] font-medium text-white transition-colors hover:bg-foreground cursor-pointer" title={tx.openSource(src.id)}>
            {m[1]}
          </button>
        ) : (
          <span key={i} className="font-semibold text-danger" title={tx.badCitation}>{p}</span>
        )
      })}
    </div>
  )
}
