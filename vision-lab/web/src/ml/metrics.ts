// Pure metric functions (no TensorFlow): they are unit-tested and reused by the line and the dashboard.
import type { EvalSummary } from '../types'

const div = (a: number, b: number) => (b === 0 ? 0 : a / b)

/**
 * Inspection metrics at a decision threshold. "Positive" = defective.
 * A product is rejected when its defect score (1 - P(good)) is at or above the threshold.
 */
export function summarize(scores: number[], defective: boolean[], threshold: number, confidences: number[] = []): EvalSummary {
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (let i = 0; i < scores.length; i++) {
    const reject = scores[i] >= threshold
    if (defective[i]) { if (reject) tp++; else fn++ } else { if (reject) fp++; else tn++ }
  }
  const n = scores.length, precision = div(tp, tp + fp), recall = div(tp, tp + fn)
  return {
    n, good: tn + fp, defective: tp + fn, tp, fp, tn, fn,
    accuracy: div(tp + tn, n), precision, recall, f1: div(2 * precision * recall, precision + recall),
    far: div(fn, tp + fn), frr: div(fp, tn + fp),
    meanConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
  }
}

/** matrix[actual][predicted] */
export function confusion(actual: number[], predicted: number[], n: number): number[][] {
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < actual.length; i++) m[actual[i]][predicted[i]]++
  return m
}

/** Precision / recall trade-off curve over thresholds 0.02 .. 0.98. */
export function sweep(scores: number[], defective: boolean[]): { threshold: number; far: number; frr: number; precision: number; recall: number }[] {
  const out = []
  for (let t = 2; t <= 98; t += 2) { const s = summarize(scores, defective, t / 100); out.push({ threshold: t / 100, far: s.far, frr: s.frr, precision: s.precision, recall: s.recall }) }
  return out
}

export function histogram(values: number[], bins: number): number[] {
  const h = new Array<number>(bins).fill(0)
  for (const v of values) h[Math.min(bins - 1, Math.max(0, Math.floor(v * bins)))]++
  return h
}

export type Verdict = 'accept' | 'reject' | 'review'
/** The line's decision rule. With a human station, scores close to the threshold go to a person. */
export function decide(score: number, threshold: number, band: number, human: boolean): Verdict {
  if (human && Math.abs(score - threshold) < band) return 'review'
  return score >= threshold ? 'reject' : 'accept'
}
