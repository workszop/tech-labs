import { describe, expect, it } from 'vitest'
import { RATES_MANUAL, RATES_NONE, ratesFromLine, ratesFromScores, scenario } from './business'
import type { BusinessConfig, LineStats } from './types'

const cfg: BusinessConfig = { dailyVolume: 10000, productValue: 5, falseRejectCost: 6, complaintCost: 95, manualCost: 0.5, defectPct: 2, source: 'test' }
const perfect = { far: 0, frr: 0 }

describe('scenario', () => {
  it('without inspection every defect escapes', () => {
    const s = scenario(cfg, RATES_NONE, perfect)
    expect(s.escaped).toBe(200); expect(s.complaints).toBe(200 * 100); expect(s.total).toBe(20000)
  })
  it('manual inspection pays for every tin and inherits human errors', () => {
    const s = scenario(cfg, RATES_MANUAL, { far: 0.1, frr: 0.05 })
    expect(s.manual).toBe(10000); expect(s.manualCost).toBe(5000)
    expect(s.escaped).toBeCloseTo(20); expect(s.falseRejects).toBeCloseTo(490)
  })
})
describe('rates', () => {
  it('from scores: review band only with a human station', () => {
    const scores = [0.9, 0.55, 0.1, 0.45], bad = [true, true, false, false]
    expect(ratesFromScores(scores, bad, 0.5, 0.1, false).def.review).toBe(0)
    const r = ratesFromScores(scores, bad, 0.5, 0.1, true)
    expect(r.def).toEqual({ reject: 0.5, accept: 0, review: 0.5 }); expect(r.good).toEqual({ reject: 0, accept: 0.5, review: 0.5 })
  })
  it('from the line: uninspected tins count as accepted', () => {
    const s: LineStats = { inspected: 20, tn: 12, tp: 3, fn: 1, fp: 2, reviewGood: 0, reviewDefective: 0, uninspected: 2, uninspectedDefective: 1, inferenceMsSum: 0, inferenceCount: 0, startedAt: 0, activeMs: 0 }
    const r = ratesFromLine(s)
    expect(r.n).toBe(20); expect(r.def.accept).toBeCloseTo(2 / 5); expect(r.good.reject).toBeCloseTo(2 / 15)
  })
})
