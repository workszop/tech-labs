import type { Lang } from '@shared/api-types'

export type CaseKind = 'ordinary' | 'exception' | 'missing' | 'restricted'
export const CASE_KINDS: CaseKind[] = ['ordinary', 'exception', 'missing', 'restricted']

export interface BenchmarkCase {
  id: string; lang: Lang; kind: CaseKind; question: string
  expectedDocIds: string[]; expectedAnswer: string
  keyFacts: string[][]; mustNotContain: string[]; builtIn: boolean
}

export type DocWarning = 'outdated' | 'draft' | 'personal-data'

export interface RetrievalScore {
  applicable: boolean
  expected: { docId: string; inContext: boolean; indexed: boolean; bestRank: number | null; bestScore: number | null }[]
  share: number
  pass: boolean
  warnings: { docId: string; flag: DocWarning }[]
}

export interface AnswerScore {
  facts: { group: string[]; found: boolean }[]
  forbidden: string[]
  pass: boolean | null
}

export interface CaseResult {
  caseId: string; runId: string | null
  status: 'done' | 'error' | 'skipped'
  retrieval: RetrievalScore | null; answer: AnswerScore | null
  answerText: string; error?: string
  override: 'pass' | 'fail' | null
}

/** Lower-cases (Polish rules), turns non-breaking and narrow spaces into spaces, collapses whitespace, trims. */
export function normalizeText(s: string): string {
  return s.toLocaleLowerCase('pl').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function scoreRetrieval(input: {
  expectedDocIds: string[]
  contextDocIds: string[]
  ranked: { docId: string; rank: number; score: number }[]
  indexedDocIds: string[]
  flagOf: (docId: string) => DocWarning | null
}): RetrievalScore {
  const { expectedDocIds, contextDocIds, ranked, indexedDocIds, flagOf } = input
  const inContextSet = new Set(contextDocIds)
  const indexedSet = new Set(indexedDocIds)

  const warnings: RetrievalScore['warnings'] = []
  for (const docId of inContextSet) {
    const flag = flagOf(docId)
    if (flag) warnings.push({ docId, flag })
  }

  if (expectedDocIds.length === 0) {
    return { applicable: false, expected: [], share: 1, pass: true, warnings }
  }

  const expected = expectedDocIds.map((docId) => {
    let best: { rank: number; score: number } | null = null
    for (const r of ranked) {
      if (r.docId === docId && (best === null || r.rank < best.rank)) best = { rank: r.rank, score: r.score }
    }
    return {
      docId,
      inContext: inContextSet.has(docId),
      indexed: indexedSet.has(docId),
      bestRank: best ? best.rank : null,
      bestScore: best ? best.score : null,
    }
  })
  const found = expected.filter((e) => e.inContext).length
  const share = found / expected.length
  return { applicable: true, expected, share, pass: found === expected.length, warnings }
}

export function scoreAnswer(answer: string, keyFacts: string[][], mustNotContain: string[]): AnswerScore {
  const text = normalizeText(answer)
  const facts = keyFacts.map((group) => ({
    group,
    found: group.some((spelling) => {
      const n = normalizeText(spelling)
      return n !== '' && text.includes(n)
    }),
  }))
  const forbidden = mustNotContain.filter((s) => {
    const n = normalizeText(s)
    return n !== '' && text.includes(n)
  })
  if (text === '') return { facts, forbidden, pass: false }
  if (keyFacts.length === 0 && mustNotContain.length === 0) return { facts, forbidden, pass: null }
  return { facts, forbidden, pass: facts.every((f) => f.found) && forbidden.length === 0 }
}

export function casePassed(r: CaseResult): boolean {
  if (r.override) return r.override === 'pass'
  return r.status === 'done' && r.retrieval?.pass === true && r.answer?.pass === true
}

export interface RunScore { passed: number; done: number; planned: number; totalActive: number; full: boolean; goodEnough: boolean; failedKinds: CaseKind[] }

export function scoreRun(results: CaseResult[], kindOf: (caseId: string) => CaseKind, planned: number, totalActive: number): RunScore {
  const done = results.filter((r) => r.status === 'done')
  const passed = results.filter(casePassed).length
  const failed = new Set<CaseKind>()
  for (const r of done) if (!casePassed(r)) failed.add(kindOf(r.caseId))
  const full = planned === totalActive && done.length === totalActive
  return {
    passed,
    done: done.length,
    planned,
    totalActive,
    full,
    goodEnough: full && passed === totalActive,
    failedKinds: CASE_KINDS.filter((k) => failed.has(k)),
  }
}
