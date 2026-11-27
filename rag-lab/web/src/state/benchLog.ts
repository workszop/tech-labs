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
  kinds: Record<CaseKind, string>
}

/** `pass` / `fail` / `manual` (nothing to check automatically); empty for a case that did not finish. */
function answerCheck(r: CaseResult): string {
  if (r.status !== 'done' || !r.answer) return ''
  return r.answer.pass === null ? 'manual' : r.answer.pass ? 'pass' : 'fail'
}

/** `pass` / `fail`; empty for a case that did not finish and was not judged by hand. */
function verdict(r: CaseResult): string {
  if (r.status !== 'done' && !r.override) return ''
  return casePassed(r) ? 'pass' : 'fail'
}

export function buildRunsCsv(runs: BenchmarkRun[], cases: BenchmarkCase[], w: RunsCsvWords, labelName: (key: string) => string): string {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const header = [w.time, w.run, w.documents, w.chunkSize, w.overlap, w.labels, w.topK, w.threshold, w.kind, w.question, w.expected, w.retrieval, w.answerCheck, w.verdict, w.overridden, w.answer]
  const rows = runs.flatMap((run, i) =>
    run.results.map((r) => {
      const c = byId.get(r.caseId)
      return [
        new Date(run.createdAt).toLocaleString(),
        i + 1,
        run.index.docTitles.join(' | '),
        run.index.chunkSize ?? '',
        run.index.overlap ?? '',
        labelName(run.index.labels),
        run.topK,
        run.threshold == null ? '' : run.threshold.toFixed(2),
        c ? w.kinds[c.kind] : '',
        c?.question ?? '',
        c ? c.expectedDocIds.join(' | ') : '',
        r.retrieval?.applicable ? r.retrieval.share.toFixed(2) : '',
        answerCheck(r),
        verdict(r),
        r.override ? w.yes : w.no,
        r.answerText || r.error || '',
      ]
    }),
  )
  return '﻿' + [header, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n') + '\r\n'
}
