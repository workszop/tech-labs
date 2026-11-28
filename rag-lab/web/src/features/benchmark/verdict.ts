/**
 * How the benchmark screens read a run. `scoreRun` counts a case that waits for the student's verdict
 * (nothing to check automatically, no override yet) as failed; the screens keep "waiting" apart.
 */
import { CASE_KINDS, casePassed, scoreRun, type CaseKind, type CaseResult, type RunScore } from '@/rag/benchmark'

export type CaseVerdict = 'pass' | 'fail' | 'waiting' | 'error' | 'skipped'

export function caseVerdict(r: CaseResult): CaseVerdict {
  if (r.status !== 'done') return r.status
  if (r.override) return r.override
  // Retrieval that failed already fails the case; the student's verdict would not change the automatic result.
  if (r.answer?.pass === null && r.retrieval?.pass !== false) return 'waiting'
  return casePassed(r) ? 'pass' : 'fail'
}

/**
 * A finished case that failed on its documents while its answer had nothing to check automatically:
 * the documents decided it, the answer was not checked (and it does not wait for the student's verdict).
 */
export function decidedByDocuments(r: CaseResult): boolean {
  return r.status === 'done' && !r.override && r.answer?.pass === null && r.retrieval?.pass === false
}

export interface RunSummary extends RunScore {
  /** Finished cases that wait for the student's verdict. */
  waiting: number
}

export function runSummary(results: CaseResult[], kindOf: (caseId: string) => CaseKind, planned: number, totalActive: number): RunSummary {
  const score = scoreRun(results, kindOf, planned, totalActive)
  const failed = new Set<CaseKind>()
  let waiting = 0
  for (const r of results) {
    const v = caseVerdict(r)
    if (v === 'waiting') waiting++
    if (v === 'fail' && r.status === 'done') failed.add(kindOf(r.caseId))
  }
  return { ...score, waiting, failedKinds: CASE_KINDS.filter((k) => failed.has(k)) }
}

export type VerdictLine = { key: 'goodEnough' } | { key: 'partial' } | { key: 'notYet'; kinds: CaseKind[] } | { key: 'waiting'; n: number }

/** The verdict line under the score: good enough only for a full run where every case passed. */
export function verdictLines(s: RunSummary): VerdictLine[] {
  if (s.goodEnough) return [{ key: 'goodEnough' }]
  const lines: VerdictLine[] = []
  if (!s.full) lines.push({ key: 'partial' })
  else if (s.failedKinds.length) lines.push({ key: 'notYet', kinds: s.failedKinds })
  if (s.waiting) lines.push({ key: 'waiting', n: s.waiting })
  return lines
}
