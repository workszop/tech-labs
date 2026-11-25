// The currently loaded classifier and its predictions on the held-out sets (kept in memory).
import * as tf from '@tensorflow/tfjs'
import type { Mode, Label, Prediction } from '../types'
import type { Classifier } from './train'

let current: Classifier | null = null
export const getClassifier = () => current
export function setClassifier(c: Classifier | null) {
  if (current && current !== c) current.model.dispose()
  current = c; predictions.clear()
}
/** Predictions of the current model, by sample id. */
export const predictions = new Map<string, Prediction>()

export function toPrediction(id: string, probs: number[]): Prediction {
  let top = 0
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i
  return { id, probs, score: 1 - probs[0], top, confidence: probs[top] }
}

const KEY = (name: string) => `indexeddb://rybex-vl-${name}`
interface Meta { mode: Mode; classes: Label[]; runId: string; name: string }

export async function saveClassifier(c: Classifier, slot: string, name: string) {
  c.model.setUserDefinedMetadata({ mode: c.mode, classes: c.classes, runId: c.runId, name } satisfies Meta)
  await c.model.save(KEY(slot))
}
function fromModel(model: tf.LayersModel): Classifier {
  const meta = model.getUserDefinedMetadata() as unknown as Meta | undefined
  const n = (model.outputs[0].shape[1] as number) ?? 2
  const mode: Mode = meta?.mode ?? (n === 2 ? 'basic' : 'advanced')
  model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy' })
  return { model, mode, classes: meta?.classes ?? (n === 2 ? ['good', 'defect'] : []), runId: meta?.runId ?? `import-${Date.now()}` }
}
export async function loadClassifier(slot: string): Promise<Classifier | null> {
  try { return fromModel(await tf.loadLayersModel(KEY(slot))) } catch { return null }
}
export async function listSaved(): Promise<{ slot: string; date: Date }[]> {
  const all = await tf.io.listModels()
  return Object.entries(all).filter(([k]) => k.startsWith('indexeddb://rybex-vl-run-')).map(([k, v]) => ({ slot: k.replace('indexeddb://rybex-vl-', ''), date: new Date(v.dateSaved) }))
}
export async function removeSaved(slot: string) { try { await tf.io.removeModel(KEY(slot)) } catch { /* already gone */ } }
export async function removeAllModels() { for (const k of Object.keys(await tf.io.listModels())) if (k.startsWith('indexeddb://rybex-vl-')) await tf.io.removeModel(k) }
/** Downloads model.json + weights.bin (the classifier head; it expects MobileNet features as input). */
export async function exportClassifier(c: Classifier, name: string) {
  c.model.setUserDefinedMetadata({ mode: c.mode, classes: c.classes, runId: c.runId, name } satisfies Meta)
  await c.model.save(`downloads://${name}`)
}
export async function importClassifier(files: File[]): Promise<Classifier> {
  const json = files.find((f) => f.name.endsWith('.json')), bin = files.filter((f) => !f.name.endsWith('.json'))
  if (!json) throw new Error('model.json missing')
  return fromModel(await tf.loadLayersModel(tf.io.browserFiles([json, ...bin])))
}
