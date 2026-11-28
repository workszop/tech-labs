import { describe, expect, it } from 'vitest'
import { FEEDBACK_TAGS, SCENARIOS } from '@/data/userTesting'
import { getCorpus } from '@/data/corpus'
import {
  INITIAL_USER_TESTING,
  canAdvance,
  resetUserTesting,
  tagCounts,
  tagHits,
  thumbsSummary,
  toggleTag,
  toggleThumb,
  type UserTestingState,
} from './userTesting'

const ids = SCENARIOS.map((s) => s.id)
const withThumbs = (n: number): UserTestingState => ({
  ...INITIAL_USER_TESTING,
  thumbs: Object.fromEntries(ids.slice(0, n).map((id, i) => [id, i % 2 ? 'down' : 'up'])),
})

describe('user testing scenarios', () => {
  it('has seven scenarios with unique ids', () => {
    expect(SCENARIOS).toHaveLength(7)
    expect(new Set(ids).size).toBe(7)
  })

  it('cites only documents that exist in both languages', () => {
    for (const s of SCENARIOS)
      for (const d of s.citedDocIds) {
        expect(getCorpus('pl').docById[d], `${s.id}: ${d}`).toBeDefined()
        expect(getCorpus('en').docById[d], `${s.id}: ${d}`).toBeDefined()
      }
  })

  it('has every text in both languages, without em-dashes', () => {
    for (const s of SCENARIOS)
      for (const lang of ['pl', 'en'] as const)
        for (const [k, v] of Object.entries(s.text[lang])) {
          expect(v.trim(), `${s.id}.${lang}.${k}`).not.toBe('')
          expect(v, `${s.id}.${lang}.${k}`).not.toContain(String.fromCharCode(0x2014))
        }
  })

  it('expects only known tags', () => {
    for (const s of SCENARIOS) for (const t of s.expected) expect(FEEDBACK_TAGS).toContain(t)
  })
})

describe('user testing state', () => {
  it('toggleThumb sets a thumb and clears it on a second click', () => {
    const a = toggleThumb(INITIAL_USER_TESTING, 's-draft', 'up')
    expect(a.thumbs['s-draft']).toBe('up')
    expect(toggleThumb(a, 's-draft', 'down').thumbs['s-draft']).toBe('down')
    expect(toggleThumb(a, 's-draft', 'up').thumbs['s-draft']).toBeUndefined()
  })

  it('toggleTag adds a tag and removes it again', () => {
    const a = toggleTag(INITIAL_USER_TESTING, 's-draft', 'wrongDocs')
    const b = toggleTag(a, 's-draft', 'wrong')
    expect(b.tags['s-draft']).toEqual(['wrongDocs', 'wrong'])
    expect(toggleTag(b, 's-draft', 'wrongDocs').tags['s-draft']).toEqual(['wrong'])
  })

  it('canAdvance needs every thumb in round 1 and every tag set in round 2', () => {
    expect(canAdvance(withThumbs(6), ids)).toBe(false)
    expect(canAdvance(withThumbs(7), ids)).toBe(true)
    const r2: UserTestingState = { ...withThumbs(7), round: 2 }
    expect(canAdvance(r2, ids)).toBe(false)
    const tagged = ids.reduce((s, id) => toggleTag(s, id, 'correct'), r2)
    expect(canAdvance(tagged, ids)).toBe(true)
    expect(canAdvance({ ...tagged, round: 3 }, ids)).toBe(false)
  })

  it('a tag removed again does not count as a rating', () => {
    const r2: UserTestingState = { ...withThumbs(7), round: 2 }
    const tagged = ids.reduce((s, id) => toggleTag(s, id, 'correct'), r2)
    expect(canAdvance(toggleTag(tagged, ids[0], 'correct'), ids)).toBe(false)
  })

  it('thumbsSummary counts ups and downs', () => {
    expect(thumbsSummary(withThumbs(7))).toEqual({ up: 4, down: 3 })
  })

  it('tagCounts lists every tag, zero by default', () => {
    const c = tagCounts(toggleTag(toggleTag(INITIAL_USER_TESTING, 's-draft', 'wrong'), 's-idk', 'wrong'))
    expect(Object.keys(c).sort()).toEqual([...FEEDBACK_TAGS].sort())
    expect(c.wrong).toBe(2)
    expect(c.tooLong).toBe(0)
  })

  it('tagHits is true when a user tag matches an expected one', () => {
    const draft = SCENARIOS.find((s) => s.id === 's-draft')!
    expect(tagHits(toggleTag(INITIAL_USER_TESTING, 's-draft', 'wrongDocs'), draft)).toBe(true)
    expect(tagHits(toggleTag(INITIAL_USER_TESTING, 's-draft', 'tooLong'), draft)).toBe(false)
  })

  it('resetUserTesting returns the initial state', () => {
    expect(resetUserTesting()).toEqual(INITIAL_USER_TESTING)
    expect(resetUserTesting()).not.toBe(INITIAL_USER_TESTING)
  })
})

describe('advanceUserTesting (store)', () => {
  it('records the guide step when the reveal is reached, so a later reset keeps it ticked', async () => {
    const { getState, updateUserTesting, advanceUserTesting } = await import('./store')
    updateUserTesting(() => ({ ...withThumbs(7), round: 2, tags: Object.fromEntries(ids.map((id) => [id, ['correct']])) }))
    advanceUserTesting()
    expect(getState().ui.userTesting.round).toBe(3)
    updateUserTesting(() => resetUserTesting())
    expect(getState().ui.guideDone).toContain('usertest')
  })

  it('does not advance before every answer is rated', async () => {
    const { getState, updateUserTesting, advanceUserTesting } = await import('./store')
    updateUserTesting(() => withThumbs(6))
    advanceUserTesting()
    expect(getState().ui.userTesting.round).toBe(1)
  })
})
