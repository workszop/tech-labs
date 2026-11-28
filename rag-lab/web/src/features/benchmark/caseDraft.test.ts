import { describe, expect, it } from 'vitest'
import { draftFromCase, draftToCase, emptyDraft, formatKeyFacts, parseKeyFacts, parseLines, validateDraft } from './caseDraft'

describe('key facts text', () => {
  it('one group per line, spellings separated by |, blanks dropped', () => {
    expect(parseKeyFacts(' 14 dni | 14 days \n\n200 zł\n | \n')).toEqual([['14 dni', '14 days'], ['200 zł']])
  })
  it('round-trips', () => {
    const facts = [['14 dni', '14 days'], ['200 zł']]
    expect(parseKeyFacts(formatKeyFacts(facts))).toEqual(facts)
  })
  it('must-not-contain: one per line', () => {
    expect(parseLines('500 000 111\n\n  R-2026-311 \n')).toEqual(['500 000 111', 'R-2026-311'])
  })
})

describe('validation', () => {
  it('needs a question', () => {
    expect(validateDraft({ ...emptyDraft(), question: '   ', kind: 'missing' }).errors).toEqual(['question'])
  })
  it('ordinary and exception cases need at least one expected document', () => {
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'ordinary' }).errors).toEqual(['docs'])
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'exception' }).errors).toEqual(['docs'])
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'exception', expectedDocIds: ['proces-04'] }).errors).toEqual([])
  })
  it('missing and restricted cases do not', () => {
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'missing' }).errors).toEqual([])
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'restricted' }).errors).toEqual([])
  })
  it('notes that the verdict is the student own when nothing can be checked', () => {
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'missing' }).studentVerdict).toBe(true)
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'missing', mustNotContain: 'x' }).studentVerdict).toBe(false)
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'missing', keyFacts: 'a | b' }).studentVerdict).toBe(false)
    expect(validateDraft({ ...emptyDraft(), question: 'Q?', kind: 'missing', keyFacts: ' \n | ' }).studentVerdict).toBe(true)
  })
})

describe('draft and case', () => {
  it('a case becomes a draft and back', () => {
    const c = { id: 'case-1', lang: 'pl' as const, kind: 'ordinary' as const, question: 'Q?', expectedDocIds: ['proces-04'], expectedAnswer: 'A.', keyFacts: [['14 dni', '14 days']], mustNotContain: ['x'], builtIn: false }
    expect(draftToCase(draftFromCase(c))).toEqual({ id: 'case-1', kind: 'ordinary', question: 'Q?', expectedDocIds: ['proces-04'], expectedAnswer: 'A.', keyFacts: [['14 dni', '14 days']], mustNotContain: ['x'] })
  })
  it('a new draft has no id and trims the question', () => {
    expect(draftToCase({ ...emptyDraft(), question: '  Q? ' })).toMatchObject({ id: undefined, question: 'Q?' })
  })
})
