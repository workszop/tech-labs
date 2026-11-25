import { describe, expect, it } from 'vitest'
import { classIndex, classesFor, imbalance, injectNoise, isUsable, isWrong, limitImages, splitByGroup } from './dataset'
import type { ClassId, Label, Sample } from '../types'

const sample = (id: string, truth: ClassId, label: Label | null = truth, group = id): Sample =>
  ({ id, source: 'synthetic', pool: 'dev', group, truth, label, selected: true, removed: false, meta: {}, addedAt: 0 })

describe('labels', () => {
  it('basic mode has two outputs, advanced seven', () => { expect(classesFor('basic')).toHaveLength(2); expect(classesFor('advanced')).toHaveLength(7) })
  it('a generic "defective" label is not specific enough for advanced mode', () => {
    expect(classIndex('defect', 'basic')).toBe(1); expect(classIndex('dent', 'basic')).toBe(1); expect(classIndex('defect', 'advanced')).toBeNull()
    expect(isUsable(sample('a', 'dent', 'defect'), 'advanced')).toBe(false)
  })
  it('wrong labels are judged at the granularity of the mode', () => {
    const s = sample('a', 'dent', 'lid')
    expect(isWrong(s, 'basic')).toBe(false); expect(isWrong(s, 'advanced')).toBe(true)
    expect(isWrong(sample('b', 'good', 'defect'), 'basic')).toBe(true)
  })
})

describe('splitByGroup', () => {
  const items = Array.from({ length: 60 }, (_, i) => sample(`s${i}`, i % 3 === 0 ? 'dent' : 'good', undefined, `g${Math.floor(i / 2)}`))
  const cls = (s: Sample) => classIndex(s.truth, 'basic')!
  it('never puts images of one tin on both sides', () => {
    const { train, val } = splitByGroup(items, 0.25, 3, cls)
    const tg = new Set(train.map((s) => s.group))
    expect(val.some((s) => tg.has(s.group))).toBe(false)
    expect(train.length + val.length).toBe(60)
    expect(val.length).toBeGreaterThan(8)
  })
  it('is reproducible for a seed', () => { expect(splitByGroup(items, 0.2, 5, cls).val.map((s) => s.id)).toEqual(splitByGroup(items, 0.2, 5, cls).val.map((s) => s.id)) })
  it('keeps at least one group of each class for training', () => {
    const tiny = [sample('a', 'good'), sample('b', 'dent')]
    expect(splitByGroup(tiny, 0.4, 1, cls).train).toHaveLength(2)
  })
})

describe('limitImages / injectNoise / imbalance', () => {
  const items = [...Array.from({ length: 80 }, (_, i) => sample(`g${i}`, 'good')), ...Array.from({ length: 20 }, (_, i) => sample(`d${i}`, 'dent'))]
  it('keeps class proportions', () => {
    const out = limitImages(items, 20, 1, (s) => classIndex(s.label, 'basic')!)
    expect(out).toHaveLength(20); expect(out.filter((s) => s.label === 'dent')).toHaveLength(4)
  })
  it('flips the requested share of labels', () => {
    const noisy = injectNoise(items, 0.3, 9, 'basic')
    expect(noisy.filter((s) => isWrong(s, 'basic'))).toHaveLength(30)
    expect(noisy.every((s, i) => s.truth === items[i].truth)).toBe(true)
  })
  it('imbalance is largest over smallest non-empty class', () => { expect(imbalance({ good: 80, dent: 20, lid: 0 })).toBe(4) })
})
