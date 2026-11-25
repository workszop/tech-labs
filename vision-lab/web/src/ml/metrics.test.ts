import { describe, expect, it } from 'vitest'
import { confusion, decide, histogram, summarize, sweep } from './metrics'

describe('summarize', () => {
  const scores = [0.9, 0.8, 0.3, 0.6, 0.1, 0.2], defective = [true, true, true, false, false, false]
  it('counts the four outcomes at the threshold', () => {
    const s = summarize(scores, defective, 0.5)
    expect([s.tp, s.fn, s.fp, s.tn]).toEqual([2, 1, 1, 2])
    expect(s.accuracy).toBeCloseTo(4 / 6)
    expect(s.far).toBeCloseTo(1 / 3) // one defective tin accepted
    expect(s.frr).toBeCloseTo(1 / 3) // one good tin rejected
    expect(s.precision).toBeCloseTo(2 / 3)
    expect(s.recall).toBeCloseTo(2 / 3)
  })
  it('a score equal to the threshold is rejected', () => { expect(summarize([0.5], [true], 0.5).tp).toBe(1) })
  it('does not divide by zero', () => { const s = summarize([], [], 0.5); expect(s.accuracy).toBe(0); expect(s.f1).toBe(0) })
  it('lowering the threshold never lets more defects through', () => {
    const rows = sweep(scores, defective)
    for (let i = 1; i < rows.length; i++) { expect(rows[i].far).toBeGreaterThanOrEqual(rows[i - 1].far); expect(rows[i].frr).toBeLessThanOrEqual(rows[i - 1].frr) }
  })
})
describe('helpers', () => {
  it('confusion is matrix[actual][predicted]', () => { expect(confusion([0, 0, 1], [0, 1, 1], 2)).toEqual([[1, 1], [0, 1]]) })
  it('histogram puts 1.0 in the last bin', () => { expect(histogram([0, 0.49, 1], 2)).toEqual([2, 1]) })
  it('decide sends scores near the threshold to a person only with a human station', () => {
    expect(decide(0.55, 0.5, 0.1, true)).toBe('review')
    expect(decide(0.55, 0.5, 0.1, false)).toBe('reject')
    expect(decide(0.2, 0.5, 0.1, true)).toBe('accept')
  })
})
