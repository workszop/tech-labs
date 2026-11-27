import { describe, expect, it } from 'vitest'
import { answerMode, answerModePatch } from './answerMode'

describe('answer mode', () => {
  it('maps the two stored flags to one decision', () => {
    expect(answerMode({ ragEnabled: true, compareMode: false })).toBe('with')
    expect(answerMode({ ragEnabled: false, compareMode: false })).toBe('without')
    expect(answerMode({ ragEnabled: true, compareMode: true })).toBe('both')
    expect(answerMode({ ragEnabled: false, compareMode: true })).toBe('without') // compare needs documents
  })
  it('round-trips', () => {
    for (const m of ['with', 'without', 'both'] as const) expect(answerMode(answerModePatch(m))).toBe(m)
  })
})
