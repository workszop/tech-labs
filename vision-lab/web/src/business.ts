// Estimated business outcome. Inputs: measured decision rates of the model (from the line session
// or the test set), measured or assumed human accuracy, and cost assumptions typed in by the student.
import type { BusinessConfig, LineStats } from './types'
import { decide } from './ml/metrics'

/** Share of defective / good products that are rejected, accepted or sent to a person. */
export interface Rates { def: { reject: number; accept: number; review: number }; good: { reject: number; accept: number; review: number }; n: number }
export interface Human { far: number; frr: number }
export interface Scenario {
  escaped: number; falseRejects: number; caught: number; manual: number; complaints: number; rejectCost: number; manualCost: number; total: number
  /** Who made the mistakes: the model on the tins it decided, the person on the tins sent to them. */
  escapedModel: number; escapedHuman: number; falseRejectsModel: number; falseRejectsHuman: number
}

const share = (a: number, b: number) => (b > 0 ? a / b : 0)

export function ratesFromLine(s: LineStats): Rates {
  const uGood = s.uninspected - s.uninspectedDefective
  const D = s.tp + s.fn + s.reviewDefective + s.uninspectedDefective, G = s.tn + s.fp + s.reviewGood + uGood
  return {
    def: { reject: share(s.tp, D), accept: share(s.fn + s.uninspectedDefective, D), review: share(s.reviewDefective, D) },
    good: { reject: share(s.fp, G), accept: share(s.tn + uGood, G), review: share(s.reviewGood, G) }, n: D + G,
  }
}

export function ratesFromScores(scores: number[], defective: boolean[], threshold: number, band: number, human: boolean): Rates {
  const c = { def: { reject: 0, accept: 0, review: 0 }, good: { reject: 0, accept: 0, review: 0 } }
  scores.forEach((s, i) => { c[defective[i] ? 'def' : 'good'][decide(s, threshold, band, human)]++ })
  const D = c.def.reject + c.def.accept + c.def.review, G = c.good.reject + c.good.accept + c.good.review
  const norm = (o: { reject: number; accept: number; review: number }, n: number) => ({ reject: share(o.reject, n), accept: share(o.accept, n), review: share(o.review, n) })
  return { def: norm(c.def, D), good: norm(c.good, G), n: D + G }
}

export const RATES_NONE: Rates = { def: { reject: 0, accept: 1, review: 0 }, good: { reject: 0, accept: 1, review: 0 }, n: 0 }
export const RATES_MANUAL: Rates = { def: { reject: 0, accept: 0, review: 1 }, good: { reject: 0, accept: 0, review: 1 }, n: 0 }

/** Expected products and costs per day. A person at the manual station misses `far` of the defects and wrongly rejects `frr` of the good tins. */
export function scenario(cfg: BusinessConfig, rates: Rates, human: Human): Scenario {
  const D = cfg.dailyVolume * (cfg.defectPct / 100), G = cfg.dailyVolume - D
  const escapedModel = D * rates.def.accept, escapedHuman = D * rates.def.review * human.far
  const falseRejectsModel = G * rates.good.reject, falseRejectsHuman = G * rates.good.review * human.frr
  const escaped = escapedModel + escapedHuman, falseRejects = falseRejectsModel + falseRejectsHuman
  const manual = D * rates.def.review + G * rates.good.review
  const complaints = escaped * (cfg.complaintCost + cfg.productValue)
  const rejectCost = falseRejects * cfg.falseRejectCost, manualCost = manual * cfg.manualCost
  return { escaped, falseRejects, caught: D - escaped, manual, complaints, rejectCost, manualCost, total: complaints + rejectCost + manualCost, escapedModel, escapedHuman, falseRejectsModel, falseRejectsHuman }
}
