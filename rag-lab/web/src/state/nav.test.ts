import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, loadPrefsFrom, getState } from './store'
import { PARTS, partMark } from './nav'

describe('stored preferences', () => {
  it('opens with the Students face when the stored prefs come from the old version', () => {
    const old = JSON.stringify({ settings: { lang: 'en', chunkSize: 300, showAllScores: true }, selection: ['proces-04'] })
    const p = loadPrefsFrom(old)
    expect(p.settings.view).toBe('students')
    expect(p.settings.chunkSize).toBe(300)
    expect(p.selection).toEqual(['proces-04'])
    expect('showAllScores' in p.settings).toBe(true) // unknown keys are tolerated until Task 3 drops them
  })
  it('keeps a stored Tech face', () => {
    expect(loadPrefsFrom(JSON.stringify({ settings: { view: 'tech' }, selection: [] })).settings.view).toBe('tech')
  })
  it('falls back to defaults on broken JSON and on null', () => {
    expect(loadPrefsFrom('{oops').settings).toEqual(DEFAULT_SETTINGS)
    expect(loadPrefsFrom(null).selection).toEqual([])
  })
  it('rejects an unknown view value', () => {
    expect(loadPrefsFrom(JSON.stringify({ settings: { view: 'admin' } })).settings.view).toBe('students')
  })
})

describe('part marks', () => {
  it('lists the five parts in order', () => {
    expect(PARTS).toEqual(['case', 'data', 'vectors', 'generator', 'benchmark'])
  })
  it('counts ticked documents and stored fragments, and hides zero', () => {
    const s = getState()
    expect(partMark('data', { ...s, selection: ['a', 'b'] })).toBe(2)
    expect(partMark('data', { ...s, selection: [] })).toBeNull()
    expect(partMark('generator', s)).toBeNull()
  })
})
