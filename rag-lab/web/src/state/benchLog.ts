/**
 * Benchmark export: one CSV row per case result, with the settings of its run, the scores and the
 * verdict. Same format as the test log (semicolon, BOM, CRLF).
 */
import { casePassed, type BenchmarkCase, type CaseKind, type CaseResult } from '@/rag/benchmark'
import { csvField } from './testLog'
import type { BenchmarkRun } from './store'

export interface RunsCsvWords {
  time: string
  run: string
  documents: string
  chunkSize: string
  overlap: string
  labels: string
  topK: string
  threshold: string
  kind: string
  question: string
  expected: string
  retrieval: string
  answerCheck: string
  verdict: string
  overridden: string
  answer: string
  yes: string
  no: string
  pass: string
  fail: string
  manual: string
  kinds: Record<CaseKind, string>
}

/** Pass / fail / manual (nothing to check automatically) in words; empty for a case that did not finish. */
function answerCheck(r: CaseResult, w: RunsCsvWords): string {
  if (r.status !== 'done' || !r.answer) return ''
  return r.answer.pass === null ? w.manual : r.answer.pass ? w.pass : w.fail
}

/** Pass / fail in words; empty for a case that did not finish and was not judged by hand. */
function verdict(r: CaseResult, w: RunsCsvWords): string {
  if (r.status !== 'done' && !r.override) return ''
  return casePassed(r) ? w.pass : w.fail
}

/** `locale` formats the run time in the language of the export (`pl-PL`, `en-US`). */
export function buildRunsCsv(runs: BenchmarkRun[], cases: BenchmarkCase[], w: RunsCsvWords, labelName: (key: string) => string, locale: string): string {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const header = [w.time, w.run, w.documents, w.chunkSize, w.overlap, w.labels, w.topK, w.threshold, w.kind, w.question, w.expected, w.retrieval, w.answerCheck, w.verdict, w.overridden, w.answer]
  const rows = runs.flatMap((run, i) =>
    run.results.map((r) => {
      // The snapshot taken when the run started first; runs stored without it fall back to the current cases.
      const c = byId.get(r.caseId)
      const info = run.caseInfo?.[r.caseId]
      const kind = info?.kind ?? c?.kind
      return [
        new Date(run.createdAt).toLocaleString(locale),
        i + 1,
        run.index.docTitles.join(' | '),
        run.index.chunkSize ?? '',
        run.index.overlap ?? '',
        labelName(run.index.labels),
        run.topK,
        run.threshold == null ? '' : run.threshold.toFixed(2),
        kind ? w.kinds[kind] : '',
        info?.question ?? c?.question ?? '',
        (info?.expectedDocTitles ?? c?.expectedDocIds ?? []).join(' | '),
        r.retrieval?.applicable ? r.retrieval.share.toFixed(2) : '',
        answerCheck(r, w),
        verdict(r, w),
        r.override ? w.yes : w.no,
        r.answerText || r.error || '',
      ]
    }),
  )
  return '﻿' + [header, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n') + '\r\n'
}
