/**
 * Principal Component Analysis via power iteration with deflation.
 *
 * We never build the d×d covariance matrix (d = 1536 for text-embedding-3-small).
 * Instead, with the centred data matrix X (n×d), we iterate v ← Xᵀ(X v), which
 * converges to the top eigenvector of XᵀX. Cost per iteration: O(n·d).
 *
 * The projection is FITTED on the document chunks only. A query vector is then
 * TRANSFORMED with the same mean and components, so adding a question does not
 * move the document points around.
 */

export interface PcaModel {
  mean: Float64Array
  components: Float64Array[] // each of length d, unit norm
  explainedVariance: number[] // eigenvalues / (n-1)
  explainedVarianceRatio: number[]
  totalVariance: number
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) / 4294967296) * 2 - 1
  }
}

export function fitPca(data: ArrayLike<number>[], nComponents = 2, iterations = 120): PcaModel {
  const n = data.length
  if (n === 0) throw new Error('PCA needs at least one vector')
  const d = data[0].length
  const mean = new Float64Array(d)
  for (const row of data) for (let j = 0; j < d; j++) mean[j] += row[j] / n
  const X = data.map((row) => {
    const r = new Float64Array(d)
    for (let j = 0; j < d; j++) r[j] = row[j] - mean[j]
    return r
  })
  let totalVariance = 0
  for (const r of X) for (let j = 0; j < d; j++) totalVariance += r[j] * r[j]
  totalVariance /= Math.max(1, n - 1)

  const rand = seeded(42)
  const components: Float64Array[] = []
  const explainedVariance: number[] = []
  const k = Math.min(nComponents, d)
  for (let c = 0; c < k; c++) {
    let v = new Float64Array(d)
    for (let j = 0; j < d; j++) v[j] = rand()
    orthonormalize(v, components)
    let lambda = 0
    for (let it = 0; it < iterations; it++) {
      const xv = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        let s = 0
        const r = X[i]
        for (let j = 0; j < d; j++) s += r[j] * v[j]
        xv[i] = s
      }
      const w = new Float64Array(d)
      for (let i = 0; i < n; i++) {
        const r = X[i]
        const s = xv[i]
        if (s !== 0) for (let j = 0; j < d; j++) w[j] += r[j] * s
      }
      orthonormalize(w, components)
      const wn = vecNorm(w)
      if (wn < 1e-12) break
      for (let j = 0; j < d; j++) w[j] /= wn
      lambda = wn
      let diff = 0
      for (let j = 0; j < d; j++) diff += Math.abs(w[j] - v[j])
      v = w
      if (diff < 1e-9) break
    }
    // deterministic sign: largest-magnitude coordinate positive
    let maxJ = 0
    for (let j = 1; j < d; j++) if (Math.abs(v[j]) > Math.abs(v[maxJ])) maxJ = j
    if (v[maxJ] < 0) for (let j = 0; j < d; j++) v[j] = -v[j]
    components.push(v)
    explainedVariance.push(lambda / Math.max(1, n - 1))
  }
  return {
    mean,
    components,
    explainedVariance,
    explainedVarianceRatio: explainedVariance.map((e) => (totalVariance > 0 ? e / totalVariance : 0)),
    totalVariance,
  }
}

function vecNorm(v: Float64Array) {
  let s = 0
  for (let j = 0; j < v.length; j++) s += v[j] * v[j]
  return Math.sqrt(s)
}

function orthonormalize(v: Float64Array, basis: Float64Array[]) {
  for (const b of basis) {
    let p = 0
    for (let j = 0; j < v.length; j++) p += v[j] * b[j]
    for (let j = 0; j < v.length; j++) v[j] -= p * b[j]
  }
}

export function transformPca(model: PcaModel, vector: ArrayLike<number>): number[] {
  return model.components.map((c) => {
    let s = 0
    for (let j = 0; j < c.length; j++) s += (vector[j] - model.mean[j]) * c[j]
    return s
  })
}
