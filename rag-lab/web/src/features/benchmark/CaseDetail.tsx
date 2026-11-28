import { AlertTriangle, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCorpus } from '@/data/corpus'
import type { BenchmarkCase, CaseResult } from '@/rag/benchmark'
import { useStore, type BenchCaseInfo } from '@/state/store'
import { useT } from '@/i18n'
import { ContextList } from '../ContextList'
import { RunDetails } from '../RetrievalView'
import { Alert, QuestionQuote } from '../common'

const H = 'mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground'

/**
 * What one case did in one run. Students: question, expected and real answer side by side, key facts,
 * forbidden content found, expected documents and warnings, plus the fragments that reached the model.
 * Tech: the same with rank and score per expected document and the full trace of the question.
 */
export function CaseDetail({ c, info, result, tech }: { c?: BenchmarkCase; info?: BenchCaseInfo; result?: CaseResult; tech: boolean }) {
  const dict = useT().lab
  const tx = dict.benchmark
  const corpus = useCorpus()
  const trace = useStore((s) => (result?.queryRunId ? s.runs[result.queryRunId] : undefined))
  const question = info?.question ?? c?.question ?? ''
  const title = (id: string) => corpus.docById[id]?.title ?? id
  return (
    <div className="space-y-3 border-t border-dashed bg-subtle/40 px-3 py-3" data-testid="bench-case-detail" data-face={tech ? 'tech' : 'students'}>
      <QuestionQuote>{dict.common.quote(question)}</QuestionQuote>
      {!result && <p className="text-[13px] text-muted-foreground">{tx.notRunNote}</p>}
      {result?.status === 'error' && <Alert tone="danger">{result.error}</Alert>}
      {result?.status === 'skipped' && <p className="text-[13px] text-muted-foreground">{tx.notRunNote}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className={H}>{tx.expectedAnswer}</div>
          <p className="whitespace-pre-wrap rounded-lg border border-hairline bg-card p-2.5 text-[13px] leading-relaxed">{c?.expectedAnswer || tx.noExpectedAnswer}</p>
        </div>
        {result?.status === 'done' && (
          <div className="min-w-0">
            <div className={H}>{tx.realAnswer}</div>
            <p className="whitespace-pre-wrap rounded-lg border border-hairline bg-card p-2.5 text-[13px] leading-relaxed" data-testid="bench-answer-text">{result.answerText}</p>
          </div>
        )}
      </div>
      {result?.status === 'done' && result.answer && (
        <div>
          <div className={H}>{tx.keyFacts}</div>
          {result.answer.facts.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">{result.answer.pass === null ? tx.noKeyFacts : tx.noFactsListed}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" data-testid="bench-facts">
              {result.answer.facts.map((f, i) => (
                <li key={i} data-found={f.found}>
                  <Badge variant={f.found ? 'ok' : 'danger'}>
                    {f.found ? <Check strokeWidth={3} /> : <X strokeWidth={3} />} {f.group.join(' | ')} · {f.found ? tx.found : tx.notFound}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {result.answer.forbidden.length === 0 && (c?.mustNotContain.length ?? 0) > 0 && (
            <p className="mt-2 text-[12.5px] text-ok" data-testid="bench-no-forbidden">{tx.noForbiddenFound}</p>
          )}
          {result.answer.forbidden.length > 0 && (
            <Alert tone="danger" className="mt-2" title={tx.forbiddenFound}>
              {result.answer.forbidden.join(', ')}
            </Alert>
          )}
        </div>
      )}
      {result?.status === 'done' && result.retrieval && (
        <div>
          <div className={H}>{tx.expectedDocs}</div>
          {!result.retrieval.applicable ? (
            <p className="text-[12.5px] text-muted-foreground">{tx.noExpectedDocs}</p>
          ) : (
            <ul className="space-y-1" data-testid="bench-expected-docs">
              {result.retrieval.expected.map((e) => (
                <li key={e.docId} className="flex flex-wrap items-center gap-1.5 text-[12.5px]" data-reached={e.inContext}>
                  <span className="font-semibold">{title(e.docId)}</span>
                  <Badge variant={e.inContext ? 'ok' : 'danger'}>{!e.indexed ? tx.notInKb : e.inContext ? tx.reached : tx.notReached}</Badge>
                  {tech && <span className="font-mono text-[11px] text-muted-foreground">{e.bestRank !== null && e.bestScore !== null ? tx.bestRank(e.bestRank, e.bestScore.toFixed(3)) : tx.notRanked}</span>}
                </li>
              ))}
            </ul>
          )}
          {result.retrieval.warnings.map((w) => (
            <p key={w.docId} className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium" data-warning={w.flag}>
              <AlertTriangle className="size-3.5 shrink-0 text-[var(--yellow-600)]" /> {tx.warnings[w.flag]}: {title(w.docId)}
            </p>
          ))}
        </div>
      )}
      {result?.status === 'done' &&
        (trace ? (
          tech ? (
            <div>
              <div className={H}>{tx.traceTitle}</div>
              <div className="-mx-3 [&>div]:p-0 [&>div]:px-3"><RunDetails run={trace} /></div>
            </div>
          ) : (
            <ContextList run={trace} />
          )
        ) : (
          <p className="text-[12px] text-muted-foreground" data-testid="bench-trace-gone">{tx.traceGone}</p>
        ))}
    </div>
  )
}
