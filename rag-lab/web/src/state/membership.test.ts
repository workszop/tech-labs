import { describe, expect, it } from 'vitest'
import { isStale, migrateSelection, planBuild } from './membership'

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
