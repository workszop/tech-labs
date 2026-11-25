// The starting dataset: the RYBEX can photos, plus synthetic scenes rendered in the browser.
import { CLASSES, type Background, type ClassId, type Design, type Lighting, type Pool, type Sample, type StressKind } from '../types'
import { rng, type Rng } from '../rng'
import type { TinSpec } from '../render/tin'
import { getStudio, type Flaw, type ViewSpec } from '../render/studio'

const PHOTO_TYPE: Record<string, ClassId> = { ok: 'good', dent: 'dent', label: 'label_wrong', code: 'marking' }
interface Manifest { sets: { red: { id: string; split: 'train' | 'val' | 'test'; type: string }[] } }

/** The RYBEX can photos: their train + val parts form the development pool, their test part is held out. */
export async function photoSamples(): Promise<Sample[]> {
  const base = import.meta.env.BASE_URL
  const man = (await (await fetch(`${base}data/manifest.json`)).json()) as Manifest
  const out: Sample[] = []
  for (const it of man.sets.red) {
    const truth = PHOTO_TYPE[it.type], pool: Pool = it.split === 'test' ? 'test' : 'dev'
    out.push({
      id: `red-${it.id}`, source: 'photo', pool, group: `red-${it.id}`, truth, label: pool === 'dev' ? null : truth, selected: true, removed: false,
      url: `${base}data/red/${it.id}.webp`, meta: { lighting: 'normal', background: 'booth', design: 'photo_red' }, addedAt: 0,
    })
  }
  return out
}

export interface Scene { id: string; group: string; pool: Pool; stress?: StressKind; tin: TinSpec; view: ViewSpec; flaw?: Flaw; selected: boolean }

export interface Variation {
  lightings: Lighting[]
  backgrounds: Background[]
  designs: Design[]
  /** Camera tilt range in degrees. */
  elevation: [number, number]
  /** Maximum camera angle to the side, degrees. */
  pan: number
  /** Maximum rotation of the tin, radians. */
  yaw: number
  severity: [number, number]
  glare: [number, number]
  occluded: boolean
}
export const DEFAULT_VARIATION: Variation = {
  lightings: ['normal', 'normal', 'normal', 'normal', 'normal', 'warm', 'dim', 'harsh'],
  backgrounds: ['station', 'station', 'station', 'station', 'booth', 'booth', 'steel', 'tray'],
  designs: ['szprot', 'makrela'], elevation: [20, 34], pan: 10, yaw: 0.35, severity: [0.4, 1], glare: [0, 0], occluded: false,
}

export function randomTin(r: Rng, defect: ClassId, v: Variation): TinSpec {
  return { seed: r.int(1, 1e9), design: r.pick(v.designs), defect, severity: r.range(v.severity[0], v.severity[1]), yaw: r.range(-v.yaw, v.yaw) }
}
export function randomView(r: Rng, v: Variation): ViewSpec {
  return {
    lighting: r.pick(v.lightings), background: r.pick(v.backgrounds), elevation: r.range(v.elevation[0], v.elevation[1]),
    pan: r.range(-v.pan, v.pan), glare: r.range(v.glare[0], v.glare[1]), occluded: v.occluded,
    zoom: r.range(0.94, 1.1), shiftX: r.range(-0.06, 0.06), shiftY: r.range(-0.05, 0.05), seed: r.int(1, 1e6),
  }
}

const STRESS: Record<Exclude<StressKind, 'packaging'>, Partial<Variation>> = {
  lighting: { lightings: ['dim', 'dim', 'warm', 'harsh'], backgrounds: ['station'] },
  angle: { elevation: [46, 60], pan: 42, yaw: 0.9, backgrounds: ['station'] },
  occluded: { occluded: true, backgrounds: ['station'] },
  subtle: { severity: [0.03, 0.16], backgrounds: ['station'] },
  glare: { lightings: ['harsh'], glare: [0.6, 1], backgrounds: ['station'] },
}

/** The scenes every new laboratory starts with. Fixed seeds: every student gets the same images. */
export function starterScenes(): Scene[] {
  const out: Scene[] = []
  const defects = CLASSES.slice(1)
  const add = (prefix: string, pool: Pool, seed: number, plan: [ClassId, number][], views: number, v: Variation, stress?: StressKind) => {
    const r = rng(seed); let n = 0
    for (const [defect, count] of plan) for (let i = 0; i < count; i++) {
      const group = `${prefix}-${String(++n).padStart(3, '0')}`, tin = randomTin(r, defect, v)
      for (let k = 0; k < views; k++) out.push({ id: `${group}-${'abcd'[k]}`, group, pool, stress, tin, view: randomView(r, v), selected: true })
    }
  }
  add('syn-dev', 'dev', 1001, [['good', 26], ...defects.map((d) => [d, 9] as [ClassId, number])], 2, DEFAULT_VARIATION)
  add('syn-test', 'test', 2002, [['good', 18], ...defects.map((d) => [d, 6] as [ClassId, number])], 1, DEFAULT_VARIATION)
  let seed = 3003
  for (const [kind, patch] of Object.entries(STRESS) as [StressKind, Partial<Variation>][]) {
    add(`syn-${kind}`, 'stress', seed++, [['good', 12], ...defects.map((d) => [d, 2] as [ClassId, number])], 1, { ...DEFAULT_VARIATION, ...patch }, kind)
  }
  add('syn-packaging', 'stress', 3100, [['good', 24], ...defects.map((d) => [d, 4] as [ClassId, number])], 1, { ...DEFAULT_VARIATION, designs: ['sledz', 'tunczyk'], backgrounds: ['station'] }, 'packaging')
  // a few unusable pictures the student is expected to find and remove
  const r = rng(4004)
  const flaws: Flaw[] = ['blur', 'blur', 'blur', 'overexposed', 'overexposed', 'cutoff', 'cutoff', 'empty']
  flaws.forEach((flaw, i) => {
    const group = `syn-low-${i + 1}`
    out.push({ id: group, group, pool: 'dev', tin: randomTin(r, r.pick(CLASSES), DEFAULT_VARIATION), view: { ...randomView(r, DEFAULT_VARIATION), background: 'station', lighting: 'normal' }, flaw, selected: true })
  })
  return out
}

/** JPEG bytes of a canvas. Synchronous on purpose: `canvas.toBlob` is an idle task and starves while a 3D scene animates. */
export function canvasBlob(c: HTMLCanvasElement, quality = 0.9): Blob {
  const bin = atob(c.toDataURL('image/jpeg', quality).split(',')[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

export async function renderScene(s: Scene, labelled = false): Promise<Sample> {
  const canvas = getStudio().render(s.tin, s.view, s.flaw)
  const truth = s.flaw === 'empty' ? null : s.tin.defect
  return {
    id: s.id, source: 'synthetic', pool: s.pool, stress: s.stress, group: s.group, truth,
    label: s.pool === 'dev' && !labelled ? null : truth, selected: s.selected, removed: false, blob: canvasBlob(canvas),
    meta: { lighting: s.view.lighting, background: s.view.background, design: s.tin.design, elevation: Math.round(s.view.elevation), yaw: s.tin.yaw, severity: s.tin.severity, lowQuality: s.flaw ? true : undefined },
    addedAt: 0,
  }
}
