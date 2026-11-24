import { describe, expect, it } from 'vitest'
import { en } from './en'
import { pl } from './pl'

function shape(v: unknown): unknown {
  if (typeof v === 'function') return 'fn'
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, shape(x)]))
  return typeof v
}

describe('dictionaries', () => {
  it('Polish mirrors the English shape', () => {
    expect(shape(pl)).toEqual(shape(en))
  })
})
