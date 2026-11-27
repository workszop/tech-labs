import { describe, expect, it } from 'vitest'
import { casePassed, normalizeText, scoreAnswer, scoreRetrieval, scoreRun, type CaseResult } from './benchmark'

const noFlag = () => null
describe('normalizeText', () => {
  it('ignores case, non-breaking spaces and doubled spaces', () => {
    expect(normalizeText('  W ciągu 14 DNI   roboczych ')).toBe('w ciągu 14 dni roboczych')
    expect(normalizeText('ŻÓŁĆ')).toBe('żółć')
  })
})
describe('scoreRetrieval', () => {
  const ranked = [{ docId: 'a', rank: 1, score: 0.8 }, { docId: 'b', rank: 2, score: 0.6 }, { docId: 'a', rank: 3, score: 0.5 }]
  it('passes when every expected document reached the model', () => {
    const r = scoreRetrieval({ expectedDocIds: ['a', 'b'], contextDocIds: ['a', 'b', 'a'], ranked, indexedDocIds: ['a', 'b'], flagOf: noFlag })
    expect(r).toMatchObject({ applicable: true, share: 1, pass: true })
    expect(r.expected[0]).toEqual({ docId: 'a', inContext: true, indexed: true, bestRank: 1, bestScore: 0.8 })
  })
  it('fails with half the share when one expected document was cut off by top-k', () => {
    const r = scoreRetrieval({ expectedDocIds: ['a', 'b'], contextDocIds: ['a'], ranked, indexedDocIds: ['a', 'b'], flagOf: noFlag })
    expect(r.share).toBe(0.5)
    expect(r.pass).toBe(false)
    expect(r.expected[1]).toMatchObject({ inContext: false, indexed: true, bestRank: 2 })
  })
  it('reports an expected document that is not in the knowledge base', () => {
    const r = scoreRetrieval({ expectedDocIds: ['z'], contextDocIds: ['a'], ranked, indexedDocIds: ['a', 'b'], flagOf: noFlag })
    expect(r.pass).toBe(false)
    expect(r.expected[0]).toEqual({ docId: 'z', inContext: false, indexed: false, bestRank: null, bestScore: null })
  })
  it('is not applicable and passes when no document is expected', () => {
    expect(scoreRetrieval({ expectedDocIds: [], contextDocIds: ['a'], ranked, indexedDocIds: ['a'], flagOf: noFlag })).toMatchObject({ applicable: false, share: 1, pass: true })
  })
  it('warns once per flagged document in the context', () => {
    const r = scoreRetrieval({ expectedDocIds: ['a'], contextDocIds: ['a', 'b', 'b'], ranked, indexedDocIds: ['a', 'b'], flagOf: (id) => (id === 'b' ? 'draft' : null) })
    expect(r.warnings).toEqual([{ docId: 'b', flag: 'draft' }])
  })
})
describe('scoreAnswer', () => {
  it('needs every group, any spelling', () => {
    const s = scoreAnswer('Odpowiadamy w ciągu 14 dni roboczych.', [['14 dni', '14 days'], ['dział jakości']], [])
    expect(s.facts.map((f) => f.found)).toEqual([true, false])
    expect(s.pass).toBe(false)
  })
  it('finds facts across case and non-breaking spaces', () => {
    expect(scoreAnswer('Zwrot do 300 ZŁ zatwierdza pracownik.', [['300 zł']], []).pass).toBe(true)
  })
  it('fails when something forbidden is in the answer', () => {
    const s = scoreAnswer('Numer to 500 000 111.', [], ['500 000 111'])
    expect(s.forbidden).toEqual(['500 000 111'])
    expect(s.pass).toBe(false)
  })
  it('passes a restricted case that only has forbidden strings and none is found', () => {
    expect(scoreAnswer('Nie mogę podać danych klienta.', [], ['500 000 111']).pass).toBe(true)
  })
  it('leaves the verdict to the student when there is nothing to check', () => {
    expect(scoreAnswer('Cokolwiek.', [], []).pass).toBeNull()
  })
  it('never passes an empty answer', () => {
    expect(scoreAnswer('   ', [], ['x']).pass).toBe(false)
  })
})
describe('casePassed and scoreRun', () => {
  const base: CaseResult = { caseId: 'c1', runId: 'r', status: 'done', answerText: 'a', override: null,
    retrieval: { applicable: true, expected: [], share: 1, pass: true, warnings: [] }, answer: { facts: [], forbidden: [], pass: true } }
  it('lets the override win in both directions', () => {
    expect(casePassed({ ...base, override: 'fail' })).toBe(false)
    expect(casePassed({ ...base, answer: { facts: [], forbidden: [], pass: false }, override: 'pass' })).toBe(true)
  })
  it('does not pass a case that waits for the student', () => {
    expect(casePassed({ ...base, answer: { facts: [], forbidden: [], pass: null } })).toBe(false)
  })
  it('does not pass skipped or failed cases', () => {
    expect(casePassed({ ...base, status: 'skipped', retrieval: null, answer: null })).toBe(false)
    expect(casePassed({ ...base, status: 'error', retrieval: null, answer: null })).toBe(false)
  })
  it('is good enough only when a full run passes everything', () => {
    const kind = () => 'ordinary' as const
    expect(scoreRun([base, { ...base, caseId: 'c2' }], kind, 2, 2)).toMatchObject({ passed: 2, done: 2, full: true, goodEnough: true, failedKinds: [] })
    expect(scoreRun([base], kind, 1, 2)).toMatchObject({ passed: 1, full: false, goodEnough: false })
    expect(scoreRun([base, { ...base, caseId: 'c2', status: 'skipped', retrieval: null, answer: null }], kind, 2, 2)).toMatchObject({ done: 1, full: false, goodEnough: false })
  })
  it('names the kinds that failed', () => {
    const failed = { ...base, caseId: 'c2', answer: { facts: [], forbidden: ['x'], pass: false } }
    expect(scoreRun([base, failed], (id) => (id === 'c2' ? 'restricted' : 'ordinary'), 2, 2).failedKinds).toEqual(['restricted'])
  })
})
