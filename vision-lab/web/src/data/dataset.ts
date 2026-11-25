// Dataset logic without any browser or TensorFlow dependency (unit-tested).
import { CLASSES, type ClassId, type Label, type Mode, type Sample } from '../types'
import { rng, shuffled } from '../rng'

export const classesFor = (mode: Mode): Label[] => (mode === 'basic' ? ['good', 'defect'] : [...CLASSES])

/** Output index of a label in the given mode, or null when the label is not specific enough. */
export function classIndex(label: Label | null, mode: Mode): number | null {
  if (label === null) return null
  if (mode === 'basic') return label === 'good' ? 0 : 1
  if (label === 'defect') return null
  return CLASSES.indexOf(label)
}

export const isActive = (s: Sample) => s.pool === 'dev' && !s.removed
/** Goes into training or validation: selected, not removed, labelled precisely enough for the mode. */
export const isUsable = (s: Sample, mode: Mode) => isActive(s) && s.selected && classIndex(s.label, mode) !== null

/** The label disagrees with the reference (at the granularity of the mode). */
export function isWrong(s: Sample, mode: Mode): boolean {
  if (s.label === null || s.truth === null) return false
  return mode === 'basic' ? (s.label === 'good') !== (s.truth === 'good') : s.label !== 'defect' && s.label !== s.truth
}

/**
 * Splits into training and validation by *group* (one physical tin or one synthetic scene),
 * stratified by class, so two pictures of the same tin never land on both sides.
 */
export function splitByGroup<T extends { group: string }>(items: T[], valSplit: number, seed: number, classOf: (s: T) => number): { train: T[]; val: T[] } {
  const groups = new Map<string, T[]>()
  for (const s of items) { const g = groups.get(s.group); if (g) g.push(s); else groups.set(s.group, [s]) }
  const byClass = new Map<number, string[]>()
  for (const [id, members] of groups) { const c = classOf(members[0]); const l = byClass.get(c); if (l) l.push(id); else byClass.set(c, [id]) }
  const r = rng(seed), valGroups = new Set<string>()
  for (const c of [...byClass.keys()].sort((a, b) => a - b)) {
    const ids = shuffled(byClass.get(c)!.sort(), r)
    let n = Math.round(ids.length * valSplit)
    if (valSplit > 0 && n === 0 && ids.length >= 2) n = 1
    if (n >= ids.length) n = ids.length - 1
    ids.slice(0, Math.max(0, n)).forEach((id) => valGroups.add(id))
  }
  const train: T[] = [], val: T[] = []
  for (const s of items) (valGroups.has(s.group) ? val : train).push(s)
  return { train, val }
}

/** At most `max` items, keeping the class proportions (and at least one item of every class). */
export function limitImages<T>(items: T[], max: number, seed: number, classOf: (s: T) => number): T[] {
  if (max <= 0 || items.length <= max) return items
  const byClass = new Map<number, T[]>()
  for (const s of items) { const c = classOf(s); const l = byClass.get(c); if (l) l.push(s); else byClass.set(c, [s]) }
  const r = rng(seed), out: T[] = []
  for (const c of [...byClass.keys()].sort((a, b) => a - b)) {
    const l = shuffled(byClass.get(c)!, r)
    out.push(...l.slice(0, Math.max(1, Math.round((l.length / items.length) * max))))
  }
  return out
}

/** Flips the labels of a random share of labelled training images: good becomes defective and the other way round. */
export function injectNoise(samples: Sample[], fraction: number, seed: number, mode: Mode): Sample[] {
  const r = rng(seed)
  const candidates = shuffled(samples.filter((s) => isActive(s) && s.label !== null && s.truth !== null && !isWrong(s, mode)), r)
  const flip = new Set(candidates.slice(0, Math.round(candidates.length * fraction)).map((s) => s.id))
  const defects = CLASSES.slice(1)
  return samples.map((s) => {
    if (!flip.has(s.id)) return s
    const label: Label = s.label === 'good' ? (mode === 'basic' ? 'defect' : r.pick(defects)) : 'good'
    return { ...s, label }
  })
}

export function countBy<T>(items: T[], key: (s: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of items) { const k = key(s); if (k !== null) out[k] = (out[k] ?? 0) + 1 }
  return out
}

/** Largest class divided by the smallest class among the classes that have images. */
export function imbalance(counts: Record<string, number>): number {
  const v = Object.values(counts).filter((n) => n > 0)
  return v.length < 2 ? 1 : Math.max(...v) / Math.min(...v)
}

export const binaryOf = (c: ClassId | Label | null): 'good' | 'defect' | null => (c === null ? null : c === 'good' ? 'good' : 'defect')
