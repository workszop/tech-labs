// Pretrained MobileNet as a frozen feature extractor. Every image becomes 1024 numbers
// (average and maximum of the last convolutional feature map); only the small classifier
// trained in train.ts learns from the student's data.
import * as tf from '@tensorflow/tfjs'
import { dbAll, dbDeleteMany, dbKeys, dbPutMany } from '../db'
import { rng, type Rng } from '../rng'

export const SIZE = 224
export const FEATURES = 1024
const MODEL_URL = `${import.meta.env.BASE_URL}models/mobilenet_v1_0.50_224/model.json`

let backend = ''
let base: Promise<tf.LayersModel> | null = null

/** WebGL (GPU) when the browser offers it, otherwise the slower pure-JavaScript CPU backend. */
export async function initBackend(): Promise<string> {
  if (backend) return backend
  try { await tf.setBackend('webgl'); await tf.ready() } catch { /* fall through */ }
  if (tf.getBackend() !== 'webgl') { await tf.setBackend('cpu'); await tf.ready() }
  backend = tf.getBackend()
  return backend
}
export const backendName = () => backend

export function loadBase(): Promise<tf.LayersModel> {
  if (!base) {
    base = (async () => {
      await initBackend()
      const full = await tf.loadLayersModel(MODEL_URL)
      const m = tf.model({ inputs: full.inputs, outputs: full.getLayer('conv_pw_13_relu').output as tf.SymbolicTensor })
      tf.tidy(() => { (m.predict(tf.zeros([1, SIZE, SIZE, 3])) as tf.Tensor).dataSync() }) // compile shaders once
      return m
    })()
    base.catch(() => { base = null })
  }
  return base
}

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap

/** Fits any picture into the 224 x 224 model input without distorting it; the border takes the corner colour. */
export function toInput(src: Drawable): HTMLCanvasElement {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width, h = 'naturalHeight' in src ? src.naturalHeight : src.height
  if (src instanceof HTMLCanvasElement && w === SIZE && h === SIZE) return src
  const c = document.createElement('canvas'); c.width = c.height = SIZE
  const x = c.getContext('2d', { willReadFrequently: true })!
  const s = SIZE / Math.max(w, h), dw = w * s, dh = h * s
  x.drawImage(src, 0, 0, 2, 2, 0, 0, SIZE, SIZE) // stretch the corner pixels over the frame
  x.drawImage(src, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh)
  return c
}

/** Data augmentation: a slightly shifted, scaled, rotated, brighter or darker copy of a training image. */
export function augment(src: HTMLCanvasElement, r: Rng): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = SIZE
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(src, 0, 0, 2, 2, 0, 0, SIZE, SIZE)
  x.translate(SIZE / 2 + r.range(-10, 10), SIZE / 2 + r.range(-10, 10))
  x.rotate(r.range(-0.07, 0.07)); const k = r.range(0.92, 1.1); x.scale(k, k)
  x.drawImage(src, -SIZE / 2, -SIZE / 2)
  x.setTransform(1, 0, 0, 1, 0, 0)
  const d = x.getImageData(0, 0, SIZE, SIZE), gain = r.range(0.72, 1.3), contrast = r.range(0.85, 1.2)
  for (let i = 0; i < d.data.length; i += 4) for (let j = 0; j < 3; j++) d.data[i + j] = Math.max(0, Math.min(255, ((d.data[i + j] - 128) * contrast + 128) * gain))
  x.putImageData(d, 0, 0)
  return c
}

/** Feature vectors for a batch of 224 x 224 canvases. */
export async function embed(canvases: HTMLCanvasElement[]): Promise<Float32Array[]> {
  const m = await loadBase()
  const out = tf.tidy(() => {
    const batch = tf.stack(canvases.map((c) => tf.browser.fromPixels(c))).toFloat().div(127.5).sub(1)
    const f = m.predict(batch) as tf.Tensor4D
    return tf.concat([f.mean([1, 2]), f.max([1, 2])], 1)
  })
  const data = (await out.data()) as Float32Array
  out.dispose()
  return canvases.map((_, i) => data.slice(i * FEATURES, (i + 1) * FEATURES))
}

// --- per-image feature cache (memory + IndexedDB): each picture passes through MobileNet once ---
const cache = new Map<string, Float32Array>()
let cacheLoaded: Promise<void> | null = null
function loadCache() {
  return (cacheLoaded ??= (async () => {
    const [keys, vals] = await Promise.all([dbKeys('features'), dbAll<Float32Array>('features')])
    keys.forEach((k, i) => { if (vals[i]?.length === FEATURES) cache.set(k, vals[i]) })
  })().catch(() => undefined))
}
export function forgetFeatures(ids: string[]) { for (const id of ids) cache.delete(id); void dbDeleteMany('features', ids) }
export function clearFeatureCache() { cache.clear(); cacheLoaded = null }

export interface Loadable { id: string; load(): Promise<HTMLCanvasElement> }

/** Features of the given images, computed in small batches so the page stays responsive. */
export async function featuresFor(items: Loadable[], onProgress?: (done: number, total: number) => void): Promise<Map<string, Float32Array>> {
  await loadCache()
  const missing = items.filter((s) => !cache.has(s.id))
  const B = 16
  for (let i = 0; i < missing.length; i += B) {
    const part = missing.slice(i, i + B)
    const f = await embed(await Promise.all(part.map((s) => s.load())))
    part.forEach((s, j) => cache.set(s.id, f[j]))
    void dbPutMany('features', part.map((s, j) => [s.id, f[j]]))
    onProgress?.(Math.min(missing.length, i + B), missing.length)
    await tf.nextFrame()
  }
  const out = new Map<string, Float32Array>()
  for (const s of items) out.set(s.id, cache.get(s.id)!)
  return out
}

/** Features of augmented copies (never cached: they are different on every training run). */
export async function augmentedFeatures(items: Loadable[], copies: number, seed: number, onProgress?: (done: number, total: number) => void): Promise<Float32Array[][]> {
  const r = rng(seed), out: Float32Array[][] = items.map(() => [])
  const B = 16, jobs = items.flatMap((s, i) => Array.from({ length: copies }, () => ({ s, i })))
  for (let k = 0; k < jobs.length; k += B) {
    const part = jobs.slice(k, k + B)
    const f = await embed(await Promise.all(part.map(async (j) => augment(await j.s.load(), r))))
    part.forEach((j, q) => out[j.i].push(f[q]))
    onProgress?.(Math.min(jobs.length, k + B), jobs.length)
    await tf.nextFrame()
  }
  return out
}
