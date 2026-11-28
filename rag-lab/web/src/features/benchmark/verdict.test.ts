import { describe, expect, it } from 'vitest'
import type { AnswerScore, CaseKind, CaseResult, RetrievalScore } from '@/rag/benchmark'
import { caseVerdict, runSummary, verdictLines } from './verdict'

const retr = (pass: boolean, applicable = true): RetrievalScore => ({ applicable, expected: [], share: pass ? 1 : 0, pass, warnings: [] })
const ans = (pass: boolean | null): AnswerScore => ({ facts: [], forbidden: [], pass })
const done = (caseId: string, rPass: boolean, aPass: boolean | null, override: CaseResult['override'] = null): CaseResult => ({
  caseId, runId: 'r', status: 'done', retrieval: retr(rPass), answer: ans(aPass), answerText: 'x', override,
})
const other = (caseId: string, status: 'error' | 'skipped'): CaseResult => ({ caseId, runId: 'r', status, retrieval: null, answer: null, answerText: '', override: null })

const kinds: Record<string, CaseKind> = { o: 'ordinary', e: 'exception', m: 'missing', r: 'restricted' }
const kindOf = (id: string) => kinds[id]

describe('one case verdict', () => {
  it('passes and fails on the automatic check', () => {
    expect(caseVerdict(done('o', true, true))).toBe('pass')
    expect(caseVerdict(done('o', true, false))).toBe('fail')
    expect(caseVerdict(done('o', false, true))).toBe('fail')
  })
  it('waits for the student when the answer has nothing to check', () => {
    expect(caseVerdict(done('m', true, null))).toBe('waiting')
  })
  it('does not wait when retrieval already failed the case', () => {
    expect(caseVerdict(done('m', false, null))).toBe('fail')
  })
  it('an override decides', () => {
    expect(caseVerdict(done('m', true, null, 'pass'))).toBe('pass')
    expect(caseVerdict(done('o', true, true, 'fail'))).toBe('fail')
  })
  it('cases that did not finish have no verdict', () => {
    expect(caseVerdict(other('o', 'error'))).toBe('error')
    expect(caseVerdict(other('o', 'skipped'))).toBe('skipped')
  })
})

describe('run summary', () => {
  it('waiting cases are not failures: their kind is not named as failing', () => {
    const s = runSummary([done('o', true, true), done('e', true, true), done('m', true, null), done('r', true, true)], kindOf, 4, 4)
    expect(s.waiting).toBe(1)
    expect(s.failedKinds).toEqual([])
    expect(s.full).toBe(true)
    expect(s.goodEnough).toBe(false)
    expect(verdictLines(s)).toEqual([{ key: 'waiting', n: 1 }])
  })
  it('a full run with failures names the failing kinds, and the waiting count too', () => {
    const s = runSummary([done('o', true, false), done('e', true, true), done('m', true, null), done('r', false, true)], kindOf, 4, 4)
    expect(s.failedKinds).toEqual(['ordinary', 'restricted'])
    expect(verdictLines(s)).toEqual([{ key: 'notYet', kinds: ['ordinary', 'restricted'] }, { key: 'waiting', n: 1 }])
  })
  it('a full run where every case passes is good enough', () => {
    const s = runSummary([done('o', true, true), done('e', true, true), done('m', true, null, 'pass'), done('r', true, true)], kindOf, 4, 4)
    expect(s.goodEnough).toBe(true)
    expect(verdictLines(s)).toEqual([{ key: 'goodEnough' }])
  })
  it('a partial run says partial, never good enough', () => {
    const s = runSummary([done('r', true, true)], kindOf, 1, 4)
    expect(s).toMatchObject({ passed: 1, done: 1, totalActive: 4, full: false, goodEnough: false })
    expect(verdictLines(s)).toEqual([{ key: 'partial' }])
  })
  it('a full plan cut short by an error is partial', () => {
    const s = runSummary([done('o', true, true), other('e', 'error'), other('m', 'skipped'), other('r', 'skipped')], kindOf, 4, 4)
    expect(s.full).toBe(false)
    expect(verdictLines(s)).toEqual([{ key: 'partial' }])
  })
})
