import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadPrefsFrom, getState } from './store'
import { goTo, PARTS, partMark, showRunDetails } from './nav'

describe('stored preferences', () => {
  it('opens with the Students face when the stored prefs come from the old version', () => {
    const old = JSON.stringify({ settings: { lang: 'en', chunkSize: 300, showAllScores: true, showRetrievalDetails: false }, selection: ['proces-04'] })
    const p = loadPrefsFrom(old)
    expect(p.settings.view).toBe('students')
    expect(p.settings.chunkSize).toBe(300)
    expect(p.selection).toEqual(['proces-04'])
    // The two retrieval toggles of the removed settings dialog are dropped.
    expect('showAllScores' in p.settings).toBe(false)
    expect('showRetrievalDetails' in p.settings).toBe(false)
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

describe('full details of an answer', () => {
  it('opens the Retrieval tab of the Case part for that answer and leaves the view alone', () => {
    expect(getState().ui.caseTechTab).toBe('retrieval')
    const view = getState().settings.view
    showRunDetails('run-1')
    expect(getState().ui.part).toBe('case')
    expect(getState().ui.caseTechTab).toBe('retrieval')
    expect(getState().activeRunId).toBe('run-1')
    expect(getState().settings.view).toBe(view)
  })
})

describe('goTo keeps the place', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('scrolls to the top only when the part changes', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('document', { querySelector: () => ({ scrollTo }) })
    goTo('data')
    expect(scrollTo).toHaveBeenCalledTimes(1)
    goTo('data') // an action inside the part (preview, build) must not throw the user to the top
    expect(scrollTo).toHaveBeenCalledTimes(1)
    goTo('vectors')
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(getState().ui.part).toBe('vectors')
  })
})
