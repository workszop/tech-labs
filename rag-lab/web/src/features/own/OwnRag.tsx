import { useRef, useState } from 'react'
import { ChevronDown, Cpu, FileText, KeyRound, MessageSquareText, Scissors, Send, Square, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStore } from '@/state/store'
import { showActivation } from '@/state/actions'
import { CHUNK_LIMITS } from '@/rag/chunker'
import { MAX_INSTRUCTIONS_CHARS } from '@shared/prompt'
import { useT } from '@/i18n'
import { Alert, QuestionQuote, SectionCard, fmtNumber, fmtUsd } from '../common'
import { OWN_LIMITS, type OwnDoc } from '@/own/files'
import { askLock, embedCostUsd, estimateEmbedTokens, needsRebuild, needsResplit, oversizedChunks, ownAskReady, type OwnRun } from '@/own/state'
import { addOwnFiles, askOwn, embedOwn, removeOwnDoc, setOwnChunking, setOwnInstructions, setOwnTopK, splitOwn, stopOwnEmbedding } from '@/own/actions'

/**
 * "Build your own RAG": four steps on the team's own files. DOM contract: [data-testid=own-rag],
 * steps [data-own-step=files|split|embed|ask], files [data-own-doc], runs [data-own-run][data-status].
 */
export function OwnRag() {
  const tx = useT().shell.own
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-background" data-testid="own-rag">
      <div className="mx-auto max-w-[60rem] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
        <div className="border-b pb-5">
          <h2 className="font-display text-[clamp(1.6rem,3.2vw,2.1rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">{tx.title}</h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-2)]">{tx.lead}</p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{tx.memoryNote}</p>
        </div>
        <FilesStep />
        <SplitStep />
        <EmbedStep />
        <AskStep />
      </div>
    </div>
  )
}

const stepTitle = (label: string, step: string) => (
  <span>
    <span className="mr-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{step}</span>
    {label}
  </span>
)

function FilesStep() {
  const tx = useT().shell.own
  const own = useStore((s) => s.own)
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState<OwnDoc | null>(null)
  const full = own.docs.length >= OWN_LIMITS.maxFiles
  const onFiles = (list: FileList | null) => list && void addOwnFiles([...list])
  return (
    <SectionCard icon={<Upload />} title={stepTitle(tx.files.title, tx.step(1))} right={tx.files.count(own.docs.length)} data-own-step="files">
      <Alert tone="doc" className="mb-3">{tx.files.note}</Alert>
      <div
        className={cn('flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors', drag ? 'border-foreground bg-subtle' : 'border-input')}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          onFiles(e.dataTransfer.files)
        }}
      >
        <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} data-testid="own-file-input" />
        <Button variant="accent" size="sm" onClick={() => input.current?.click()} disabled={full}>
          <Upload /> {own.parsing ? tx.files.reading : tx.files.pick}
        </Button>
        <span className="text-[12.5px] text-muted-foreground">{tx.files.drop}</span>
        <span className="text-[11.5px] text-muted-foreground">{tx.files.limits}</span>
      </div>

      {own.docs.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">{tx.files.empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)] rounded-lg border">
          {own.docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" data-own-doc={d.name}>
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{d.name}</span>
              <Badge variant="outline">{d.kind.toUpperCase()}</Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                {tx.files.pages(d.pages)} · {tx.files.chars(fmtNumber(d.chars), d.chars)} · {tx.files.tokens(fmtNumber(d.chars / 4), Math.round(d.chars / 4))}
              </span>
              <Button variant="ghost" size="xs" onClick={() => setPreview(d)}>{tx.files.preview}</Button>
              <Button variant="ghost" size="icon-sm" onClick={() => removeOwnDoc(d.id)} aria-label={tx.files.removeAria(d.name)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {own.rejected.length > 0 && (
        <div className="mt-3" data-testid="own-rejected" role="status" aria-live="polite">
          <div className="mb-1 text-[12.5px] font-semibold">{tx.files.rejectedTitle}</div>
          <ul className="space-y-0.5 text-[12.5px]">
            {own.rejected.map((r, i) => (
              <li key={`${r.name}-${i}`} data-reason={r.reason}>
                <span className="font-medium">{r.name}</span>: <span className="text-danger">{tx.files.reasons[r.reason]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>{preview && `${tx.files.pages(preview.pages)} · ${tx.files.chars(fmtNumber(preview.chars), preview.chars)}`}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <pre className="scroll-thin max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{preview?.text}</pre>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

function SplitStep() {
  const tx = useT().shell.own
  const own = useStore((s) => s.own)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const maxOverlap = Math.floor(own.chunkSize * CHUNK_LIMITS.maxOverlapRatio)
  const stale = own.split && needsResplit(own)
  return (
    <SectionCard icon={<Scissors />} title={stepTitle(tx.split.title, tx.step(2))} right={own.split ? tx.split.summary(own.chunks.length, own.split.docIds.length) : undefined} data-own-step="split">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 flex justify-between font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">
            {tx.split.size} <span>{own.chunkSize}</span>
          </span>
          <Slider min={CHUNK_LIMITS.minSize} max={CHUNK_LIMITS.maxSize} step={20} value={[own.chunkSize]} onValueChange={([v]) => setOwnChunking(v, Math.min(own.overlap, Math.floor(v * CHUNK_LIMITS.maxOverlapRatio)))} aria-label={tx.split.size} />
        </label>
        <label className="block">
          <span className="mb-1.5 flex justify-between font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">
            {tx.split.overlap} <span>{own.overlap}</span>
          </span>
          <Slider min={0} max={maxOverlap} step={10} value={[own.overlap]} onValueChange={([v]) => setOwnChunking(own.chunkSize, v)} aria-label={tx.split.overlap} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant={own.split && !stale ? 'outline' : 'accent'}
          size="sm"
          disabled={!own.docs.length || busy}
          data-testid="own-split"
          onClick={async () => {
            setBusy(true)
            try {
              await splitOwn()
            } finally {
              setBusy(false)
            }
          }}
        >
          <Scissors /> {own.split ? tx.split.again : tx.split.run}
        </Button>
        {!own.docs.length && <span className="text-[12.5px] text-muted-foreground">{tx.split.needFiles}</span>}
        {stale && <span className="text-[12.5px] font-medium text-[var(--yellow-ink)] bg-primary rounded px-2 py-0.5">{tx.split.stale}</span>}
      </div>
      {own.split && (
        <ul className="mt-3 space-y-1.5">
          {own.docs
            .filter((d) => own.split!.docIds.includes(d.id))
            .map((d) => {
              const cs = own.chunks.filter((c) => c.docId === d.id)
              const isOpen = open === d.id
              return (
                <li key={d.id} className="rounded-lg border">
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] cursor-pointer" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen}>
                    <ChevronDown className={cn('size-4 transition-transform', !isOpen && '-rotate-90')} />
                    <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{tx.split.perDoc(cs.length)}</span>
                  </button>
                  {isOpen && (
                    <ol className="scroll-thin max-h-80 space-y-2 overflow-y-auto border-t px-3 py-2">
                      {cs.map((c) => (
                        <li key={c.id} className="rounded-md bg-subtle px-2.5 py-1.5">
                          <div className="font-mono text-[10.5px] text-muted-foreground">{tx.split.chunkLabel(c.index + 1, c.tokens)}</div>
                          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{c.text}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
        </ul>
      )}
    </SectionCard>
  )
}

function EmbedStep() {
  const tx = useT().shell.own
  const own = useStore((s) => s.own)
  const status = useStore((s) => s.auth.status)
  const caps = useStore((s) => s.auth.session?.capabilities)
  const [confirm, setConfirm] = useState(false)
  const tokens = estimateEmbedTokens(own.chunks)
  const running = own.embed.status === 'running'
  const canSplitChunks = !!own.split && !needsResplit(own)
  const stale = own.indexed && needsRebuild(own)
  const lock = askLock(status, caps)
  const oversized = caps ? oversizedChunks(own.chunks, caps.maxEmbeddingInputTokens).length : 0
  const cost = embedCostUsd(tokens, caps?.embeddingPricePerMTok)
  return (
    <SectionCard icon={<Cpu />} title={stepTitle(tx.embed.title, tx.step(3))} right={caps ? tx.embed.model(caps.embeddingModel) : undefined} data-own-step="embed" data-status={own.embed.status}>
      {!canSplitChunks ? (
        <p className="text-[13px] text-muted-foreground">{tx.embed.needSplit}</p>
      ) : (
        <>
          <p className="text-[13.5px]" data-testid="own-embed-estimate">
            {tx.embed.estimate(own.chunks.length, fmtNumber(tokens), tokens)}
            {cost != null && <span className="text-muted-foreground"> · {tx.embed.cost(fmtUsd(cost))}</span>}
          </p>
          {oversized > 0 && caps && <Alert tone="warn" className="mt-2">{tx.embed.oversized(oversized, caps.maxEmbeddingInputTokens)}</Alert>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {lock === 'worker' ? (
              <div data-testid="own-worker-lock-embed"><Alert tone="warn">{tx.ask.lockedWorker}</Alert></div>
            ) : status !== 'active' ? (
              <>
                <Button variant="accent" size="sm" onClick={showActivation}>
                  <KeyRound /> {tx.ask.activate}
                </Button>
                <span className="text-[12.5px] text-muted-foreground">{tx.ask.lockedCode}</span>
              </>
            ) : running ? (
              <Button variant="outline" size="sm" onClick={stopOwnEmbedding}>
                <Square /> {tx.embed.stop}
              </Button>
            ) : (
              <Button variant={own.embed.status === 'done' && !stale ? 'outline' : 'accent'} size="sm" onClick={() => setConfirm(true)} disabled={oversized > 0} data-testid="own-embed">
                <Cpu /> {own.embed.status === 'done' ? tx.embed.again : tx.embed.run}
              </Button>
            )}
          </div>
          {(running || own.embed.status === 'done' || own.embed.status === 'error') && own.embed.total > 0 && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(own.embed.done / own.embed.total) * 100}%` }} />
              </div>
              <div className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                {own.embed.status === 'done' ? tx.embed.done(own.embed.done, fmtNumber(own.embed.tokens), own.embed.tokens) : tx.embed.progress(own.embed.done, own.embed.total)}
              </div>
            </div>
          )}
          {own.embed.status === 'error' && <Alert tone="danger" className="mt-3">{own.embed.error}</Alert>}
        </>
      )}
      {stale && own.split && <Alert tone="warn" className="mt-3">{tx.embed.stale}</Alert>}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent data-testid="own-embed-dialog">
          <DialogHeader>
            <DialogTitle>{tx.embed.confirmTitle}</DialogTitle>
            <DialogDescription>{tx.embed.confirmBody(own.chunks.length, fmtNumber(tokens), tokens)}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 border-t border-dashed px-5 py-3">
            <Button variant="outline" onClick={() => setConfirm(false)}>{tx.embed.cancel}</Button>
            <Button
              variant="accent"
              data-testid="own-embed-confirm"
              onClick={() => {
                setConfirm(false)
                void embedOwn()
              }}
            >
              <Cpu /> {tx.embed.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

function AskStep() {
  const tx = useT().shell.own
  const own = useStore((s) => s.own)
  const status = useStore((s) => s.auth.status)
  const caps = useStore((s) => s.auth.session?.capabilities)
  const [q, setQ] = useState('')
  const lock = askLock(status, caps)
  const ready = ownAskReady(own)
  const busy = own.runs.some((r) => r.status === 'running')
  const runs = [...own.runs].reverse()
  const send = () => {
    if (!q.trim() || busy) return
    void askOwn(q)
    setQ('')
  }
  return (
    <SectionCard icon={<MessageSquareText />} title={stepTitle(tx.ask.title, tx.step(4))} data-own-step="ask" data-lock={lock ?? ''}>
      <label className="block">
        <span className="mb-1 flex justify-between text-[13px] font-semibold">
          {tx.ask.instructions} <span className="font-mono text-[11px] font-normal text-muted-foreground">{tx.ask.counter(own.instructions.length, MAX_INSTRUCTIONS_CHARS)}</span>
        </span>
        <textarea
          value={own.instructions}
          onChange={(e) => setOwnInstructions(e.target.value)}
          maxLength={MAX_INSTRUCTIONS_CHARS}
          rows={3}
          placeholder={tx.ask.instructionsPlaceholder}
          className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[13.5px] leading-relaxed focus-visible:outline-2 focus-visible:outline-foreground"
          data-testid="own-instructions"
        />
        <span className="text-[11.5px] text-muted-foreground">{tx.ask.instructionsHint}</span>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12.5px]">
          {tx.ask.topK}
          <select value={own.topK} onChange={(e) => setOwnTopK(Number(e.target.value))} className="rounded-md border border-input bg-card px-2 py-1 font-mono text-[12.5px]" data-testid="own-topk">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      {lock === 'code' ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="accent" size="sm" onClick={showActivation}>
            <KeyRound /> {tx.ask.activate}
          </Button>
          <span className="text-[12.5px] text-muted-foreground">{tx.ask.lockedCode}</span>
        </div>
      ) : lock === 'worker' ? (
        <div data-testid="own-worker-lock"><Alert tone="warn" className="mt-3">{tx.ask.lockedWorker}</Alert></div>
      ) : !ready ? (
        <p className="mt-3 text-[13px] text-muted-foreground">{tx.ask.needVectors}</p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={caps?.maxQuestionChars} placeholder={tx.ask.questionPlaceholder} aria-label={tx.ask.question} className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-[13.5px]" data-testid="own-question" />
          <Button type="submit" variant="accent" disabled={!q.trim() || busy} data-testid="own-ask">
            <Send /> {tx.ask.send}
          </Button>
        </form>
      )}

      {runs.length > 0 && (
        <ol className="mt-4 space-y-4">
          {runs.map((r) => (
            <RunCard key={r.id} run={r} />
          ))}
        </ol>
      )}
    </SectionCard>
  )
}

function RunCard({ run }: { run: OwnRun }) {
  const tx = useT().shell.own.ask
  const [showPrompt, setShowPrompt] = useState(false)
  return (
    <li className="space-y-2 rounded-xl border bg-card p-3" data-own-run={run.id} data-status={run.status}>
      <QuestionQuote className="text-[13.5px]">{run.question}</QuestionQuote>
      {run.status === 'error' ? (
        <Alert tone="danger">{run.error}</Alert>
      ) : (
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed" data-testid="own-answer" aria-live="polite" aria-busy={run.status === 'running'}>{run.answer || (run.status === 'running' ? tx.thinking : '')}</p>
      )}
      {run.sent.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-muted-foreground">{tx.sent(run.sent.length, run.topK)}</div>
          {run.trimmed > 0 && <Alert tone="warn" className="mt-1">{tx.trimmed(run.trimmed)}</Alert>}
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[12.5px] font-semibold">{tx.sources}</summary>
            <ol className="mt-1.5 space-y-1.5">
              {run.sent.map((s, i) => (
                <li key={s.chunkId} className="rounded-md bg-subtle px-2.5 py-1.5 text-[12.5px]">
                  <div className="font-mono text-[10.5px] text-muted-foreground">
                    [{i + 1}] {s.docName} · #{s.index + 1} · {tx.similarity(s.score.toFixed(2))}
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap">{s.text}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {run.prompt && (
        <div>
          <button className="text-[12.5px] font-semibold underline underline-offset-2 cursor-pointer" onClick={() => setShowPrompt((v) => !v)} aria-expanded={showPrompt}>
            {tx.prompt}
          </button>
          {showPrompt && (
            <div className="mt-1.5 space-y-2" data-testid="own-prompt">
              {run.prompt.messages.map((m, i) => (
                <div key={i} className="rounded-md border px-2.5 py-1.5">
                  <div className="font-mono text-[10.5px] uppercase text-muted-foreground">{m.role}</div>
                  <pre className="scroll-thin max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed">{m.content}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
