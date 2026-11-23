import { describe, expect, it } from 'vitest'
import { fitPca, transformPca } from './pca'

describe('PCA', () => {
  it('finds the dominant direction of variance', () => {
    // points spread along (1,1,0), small noise along z
    const data = Array.from({ length: 50 }, (_, i) => {
      const t = i - 25
      return [t, t, (i % 3) * 0.1]
    })
    const m = fitPca(data, 2)
    const pc1 = m.components[0]
    expect(Math.abs(pc1[0])).toBeCloseTo(Math.SQRT1_2, 2)
    expect(Math.abs(pc1[1])).toBeCloseTo(Math.SQRT1_2, 2)
    expect(m.explainedVarianceRatio[0]).toBeGreaterThan(0.99)
    // components are orthonormal
    const dot = pc1.reduce((s, v, j) => s + v * m.components[1][j], 0)
    expect(Math.abs(dot)).toBeLessThan(1e-6)
  })
  it('projects new points with the fitted model (doc points do not move)', () => {
    const data = [[0, 0, 0], [2, 0, 0], [0, 1, 0], [2, 1, 0]]
    const m = fitPca(data, 2)
    const a = transformPca(m, data[1])
    const m2 = fitPca(data, 2)
    expect(transformPca(m2, data[1])).toEqual(a)
    const q = transformPca(m, [1, 0.5, 0])
    expect(Math.hypot(...q)).toBeCloseTo(0, 6) // the mean projects to the origin
  })
  it('is deterministic', () => {
    const data = Array.from({ length: 20 }, (_, i) => [Math.sin(i), Math.cos(i * 1.3), i / 10, (i * 7) % 5])
    expect(fitPca(data, 3).components.map((c) => Array.from(c))).toEqual(fitPca(data, 3).components.map((c) => Array.from(c)))
  })
})
