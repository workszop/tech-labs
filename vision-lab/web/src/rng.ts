/** Small seeded generator (mulberry32) so datasets, splits and scenes are reproducible. */
export interface Rng { (): number; range(a: number, b: number): number; int(a: number, b: number): number; pick<T>(xs: readonly T[]): T; chance(p: number): boolean }
export function rng(seed: number): Rng {
  let a = (seed >>> 0) || 1
  const f = (() => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  f.range = (lo, hi) => lo + (hi - lo) * f()
  f.int = (lo, hi) => Math.floor(f.range(lo, hi + 1))
  f.pick = (xs) => xs[Math.floor(f() * xs.length)]
  f.chance = (p) => f() < p
  return f
}
export function shuffled<T>(xs: readonly T[], r: Rng): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
