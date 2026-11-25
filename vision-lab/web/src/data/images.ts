import type { Sample } from '../types'
import { toInput } from '../ml/features'

const urls = new WeakMap<Blob, string>()
/** A URL that an <img> can show. */
export function sampleUrl(s: Sample): string {
  if (s.url) return s.url
  if (!s.blob) return ''
  let u = urls.get(s.blob)
  if (!u) { u = URL.createObjectURL(s.blob); urls.set(s.blob, u) }
  return u
}
/** The 224 x 224 picture the model sees. */
export async function loadCanvas(s: Sample): Promise<HTMLCanvasElement> {
  const img = new Image(); img.src = sampleUrl(s); await img.decode()
  return toInput(img)
}
export const loadable = (s: Sample) => ({ id: s.id, load: () => loadCanvas(s) })

export function download(name: string, data: Blob | string, type = 'application/json') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(r.error); r.readAsDataURL(b) })
}
export async function dataUrlToBlob(u: string): Promise<Blob> { return (await fetch(u)).blob() }
