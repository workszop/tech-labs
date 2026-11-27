import { describe, expect, it } from 'vitest'
import { initialSelection, isStale, migrateSelection, planBuild } from './membership'
import { loadPrefsFrom } from './store'

const H = { a: 'h1', b: 'h2', c: 'h3' }
describe('planBuild', () => {
  it('adds ticked documents that are not indexed', () => {
    expect(planBuild(['a', 'b'], { a: 'h1' }, H, false)).toEqual({ add: ['b'], remove: [], resplit: [] })
  })
  it('removes indexed documents that are no longer ticked', () => {
    expect(planBuild(['a'], { a: 'h1', b: 'h2' }, H, false)).toEqual({ add: [], remove: ['b'], resplit: [] })
  })
  it('re-adds a document whose text changed', () => {
    expect(planBuild(['a'], { a: 'old' }, H, false).add).toEqual(['a'])
  })
  it('re-splits unchanged documents when the settings changed', () => {
    expect(planBuild(['a', 'b'], { a: 'h1' }, H, true)).toEqual({ add: ['b'], remove: [], resplit: ['a'] })
  })
  it('is not stale when ticks and database agree', () => {
    expect(isStale(planBuild(['a'], { a: 'h1' }, H, false))).toBe(false)
  })
  it('is stale when everything was unticked', () => {
    expect(isStale(planBuild([], { a: 'h1' }, H, false))).toBe(true)
  })
})
describe('migrateSelection', () => {
  it('ticks what the old version had already indexed', () => {
    expect(migrateSelection(['c'], ['a', 'b'])).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(migrateSelection([], [])).toEqual([])
  })
})

describe('initialSelection (the migration runs once per browser)', () => {
  const order = ['a', 'b', 'c']
  it('without the marker, ticks the indexed documents too', () => {
    expect(initialSelection(['c'], false, ['a', 'b'], order)).toEqual(['a', 'b', 'c'])
  })
  it('with the marker, an unticked indexed document stays unticked and is planned for removal', () => {
    const sel = initialSelection(['a'], true, ['a', 'b'], order)
    expect(sel).toEqual(['a'])
    expect(planBuild(sel, { a: 'h1', b: 'h2' }, H, false).remove).toEqual(['b'])
  })
  it('keeps corpus order and drops ids that are not in the corpus', () => {
    expect(initialSelection(['c', 'x', 'a'], true, [], order)).toEqual(['a', 'c'])
  })
})
describe('membership marker in the stored preferences', () => {
  it('is false for prefs saved by an older version and true when present', () => {
    expect(loadPrefsFrom(JSON.stringify({ settings: {}, selection: ['a'] })).selectionIsMembership).toBe(false)
    expect(loadPrefsFrom(JSON.stringify({ settings: {}, selection: ['a'], selectionIsMembership: true })).selectionIsMembership).toBe(true)
    expect(loadPrefsFrom(null).selectionIsMembership).toBe(false)
  })
})
