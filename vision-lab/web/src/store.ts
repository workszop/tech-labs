// Application state (one object, immutable updates), persistence to IndexedDB, and all actions.
import { useSyncExternalStore } from 'react'
import type { BusinessConfig, ClassId, EvalSummary, Label, LineSettings, LineStats, ManualResult, Mode, Run, Sample, StressKind, TrainConfig } from './types'
import { STRESS_KINDS } from './types'
import { dbAll, dbDeleteMany, dbGet, dbPut, dbPutMany, dbWipe } from './db'
import { classIndex, classesFor, countBy, injectNoise, isActive, isUsable, isWrong, limitImages, splitByGroup } from './data/dataset'
import { canvasBlob, photoSamples, renderScene, starterScenes, type Scene } from './data/seed'
import { blobToDataUrl, dataUrlToBlob, download, loadable } from './data/images'
import { augmentedFeatures, backendName, clearFeatureCache, featuresFor, forgetFeatures, initBackend, loadBase } from './ml/features'
import { predict, train, type Classifier, type EpochInfo } from './ml/train'
import { getClassifier, loadClassifier, predictions, removeAllModels, saveClassifier, setClassifier, toPrediction } from './ml/session'
import { summarize } from './ml/metrics'
import { hashString } from './rng'

export type Lang = 'pl' | 'en'
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export interface Progress { key: 'seed' | 'features' | 'augment' | 'evaluate' | 'model'; done: number; total: number }
export interface Training { epoch: number; epochs: number; live: EpochInfo[]; stop: boolean }

export interface State {
  ready: boolean
  error: string | null
  lang: Lang
  stage: StageId
  mode: Mode
  samples: Sample[]
  seeded: boolean
  manual: ManualResult | null
  train: TrainConfig
  runs: Run[]
  currentRunId: string | null
  /** Bumped whenever the loaded classifier or its predictions change. */
  modelVersion: number
  threshold: number
  line: LineSettings
  lineStats: LineStats
  business: BusinessConfig
  experiment: string | null
  backend: string
  progress: Progress | null
  training: Training | null
  lowQualityFound: number
}

export const DEFAULT_TRAIN: TrainConfig = { epochs: 30, learningRate: 0.001, batchSize: 16, valSplit: 0.2, augment: false, maxImages: 0, balance: false, seed: 7 }
export const DEFAULT_LINE: LineSettings = { running: true, speed: 40, defectRate: 20, lighting: 'normal', elevation: 27, pan: 0, designs: ['szprot', 'makrela'], yawJitter: 0.3, human: false, band: 0.2 }
export const emptyLineStats = (): LineStats => ({ inspected: 0, tn: 0, tp: 0, fn: 0, fp: 0, reviewGood: 0, reviewDefective: 0, uninspected: 0, uninspectedDefective: 0, inferenceMsSum: 0, inferenceCount: 0, startedAt: Date.now(), activeMs: 0 })
export const DEFAULT_BUSINESS: BusinessConfig = { dailyVolume: 40000, productValue: 6, falseRejectCost: 7, complaintCost: 250, manualCost: 0.4, defectPct: 2, source: 'test' }

const initial: State = {
  ready: false, error: null, lang: 'pl', stage: 1, mode: 'basic', samples: [], seeded: false, manual: null, train: DEFAULT_TRAIN, runs: [], currentRunId: null,
  modelVersion: 0, threshold: 0.5, line: DEFAULT_LINE, lineStats: emptyLineStats(), business: DEFAULT_BUSINESS, experiment: null, backend: '', progress: null, training: null, lowQualityFound: 0,
}
const PERSISTED = ['lang', 'stage', 'mode', 'seeded', 'manual', 'train', 'runs', 'currentRunId', 'threshold', 'line', 'lineStats', 'business', 'experiment'] as const

let state = initial
const listeners = new Set<() => void>()
export const getState = () => state
let saveTimer = 0
const persistedSamples = new Map<string, Sample>()

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  listeners.forEach((l) => l())
  if (state.ready) { clearTimeout(saveTimer); saveTimer = window.setTimeout(persist, 400) }
}
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => selector(state))
}

async function persist() {
  const kv: Record<string, unknown> = {}
  for (const k of PERSISTED) kv[k] = state[k]
  const changed: [string, Sample][] = []
  const seen = new Set<string>()
  for (const s of state.samples) { seen.add(s.id); if (persistedSamples.get(s.id) !== s) { changed.push([s.id, s]); persistedSamples.set(s.id, s) } }
  const gone = [...persistedSamples.keys()].filter((id) => !seen.has(id))
  gone.forEach((id) => persistedSamples.delete(id))
  try { await dbPut('kv', 'state', kv); await dbPutMany('samples', changed); await dbDeleteMany('samples', gone) } catch (e) { console.warn('persist failed', e) }
}

// ---------- start-up ----------
const SEED_VERSION = 1
export async function init() {
  try {
    const [kv, stored, version] = await Promise.all([dbGet<Partial<State>>('kv', 'state'), dbAll<Sample>('samples'), dbGet<number>('kv', 'seedVersion')])
    const fresh = version !== SEED_VERSION || !stored.length
    stored.forEach((s) => persistedSamples.set(s.id, s))
    const urlLang = new URLSearchParams(location.search).get('lang')
    const restored: Partial<State> = fresh ? {} : { ...kv, line: { ...DEFAULT_LINE, ...kv?.line, running: true }, train: { ...DEFAULT_TRAIN, ...kv?.train }, business: { ...DEFAULT_BUSINESS, ...kv?.business } }
    if (urlLang === 'en' || urlLang === 'pl') restored.lang = urlLang
    let samples = fresh ? [] : stored
    if (fresh) { samples = await photoSamples(); await dbPut('kv', 'seedVersion', SEED_VERSION) }
    else {
      // bundled photos keep their current URL even when the site moved
      const base = import.meta.env.BASE_URL
      samples = samples.map((s) => (s.url ? { ...s, url: `${base}data/red/${s.id.replace(/^red-/, '')}.webp` } : s))
      samples.forEach((s) => persistedSamples.set(s.id, s))
    }
    setState({ ...restored, samples, ready: true, lowQualityFound: samples.filter((s) => s.meta.lowQuality && s.removed).length })
    void initBackend().then((b) => setState({ backend: b }))
    if (!state.seeded) void seedSynthetic()
    if (state.currentRunId) {
      const c = await loadClassifier('current')
      if (c) { setClassifier(c); setState((s) => ({ modelVersion: s.modelVersion + 1 })) } else setState({ currentRunId: null })
    }
  } catch (e) { setState({ error: String(e), ready: true }) }
}

/** Renders the synthetic starter scenes in the background (once per browser). */
async function seedSynthetic() {
  const have = new Set(state.samples.map((s) => s.id))
  const scenes = starterScenes().filter((s) => !have.has(s.id))
  await renderScenes(scenes, 'seed')
  setState({ seeded: true, progress: null })
}
export async function renderScenes(scenes: Scene[], key: Progress['key'] = 'seed', labelled = false) {
  const batch: Sample[] = []
  const flush = () => { if (batch.length) { const add = batch.splice(0); setState((s) => ({ samples: [...s.samples, ...add] })) } }
  for (let i = 0; i < scenes.length; i++) {
    batch.push({ ...(await renderScene(scenes[i], labelled)), addedAt: Date.now() })
    if (i % 12 === 11) { flush(); setState({ progress: { key, done: i + 1, total: scenes.length } }); await new Promise((r) => setTimeout(r, 0)) }
  }
  flush(); setState({ progress: null })
}

// ---------- dataset actions ----------
const mapSamples = (ids: Iterable<string>, f: (s: Sample) => Sample) => {
  const set = new Set(ids)
  setState((s) => ({ samples: s.samples.map((x) => (set.has(x.id) ? f(x) : x)) }))
}
export const setLabel = (ids: string[], label: Label | null) => mapSamples(ids, (s) => ({ ...s, label }))
export const setSelected = (ids: string[], selected: boolean) => mapSamples(ids, (s) => ({ ...s, selected }))
export function removeSamples(ids: string[]) {
  mapSamples(ids, (s) => ({ ...s, removed: true }))
  setState((s) => ({ lowQualityFound: s.samples.filter((x) => x.meta.lowQuality && x.removed).length }))
}
export function restoreRemoved() {
  setState((s) => ({ samples: s.samples.map((x) => (x.removed ? { ...x, removed: false } : x)), lowQualityFound: 0 }))
}
export const addSamples = (add: Sample[]) => setState((s) => ({ samples: [...s.samples, ...add] }))
/** Fills every still unlabelled training image with the reference label of the quality team. */
export function autoLabel() {
  setState((s) => ({ samples: s.samples.map((x) => (isActive(x) && x.label === null && x.truth !== null && !x.meta.lowQuality ? { ...x, label: x.truth } : x)) }))
}
export function restoreLabels() {
  setState((s) => ({ samples: s.samples.map((x) => (isActive(x) && x.truth !== null && x.label !== null && x.label !== x.truth ? { ...x, label: x.truth } : x)) }))
}
export function addNoise(fraction: number) {
  setState((s) => ({ samples: injectNoise(s.samples, fraction, Date.now() & 0xffff, s.mode) }))
}
export function setMode(mode: Mode) { setState({ mode }) }

// ---------- training ----------
export function trainingSet(s: State = state) { return s.samples.filter((x) => isUsable(x, s.mode)) }

export async function runTraining(): Promise<string | null> {
  if (state.training) return null
  const mode = state.mode, cfg = state.train, classes = classesFor(mode)
  const cls = (s: Sample) => classIndex(s.label, mode)!
  const pool = limitImages(trainingSet(), cfg.maxImages, cfg.seed, cls)
  const { train: tr, val } = splitByGroup(pool, cfg.valSplit, cfg.seed, cls)
  if (new Set(tr.map(cls)).size < 2) return 'needTwoClasses'
  setState({ training: { epoch: 0, epochs: cfg.epochs, live: [], stop: false }, progress: { key: 'model', done: 0, total: 1 } })
  try {
    await loadBase()
    const feats = await featuresFor(pool.map(loadable), (done, total) => setState({ progress: { key: 'features', done, total } }))
    const x = tr.map((s) => feats.get(s.id)!), y = tr.map(cls)
    if (cfg.augment) {
      const extra = await augmentedFeatures(tr.map(loadable), 2, cfg.seed, (done, total) => setState({ progress: { key: 'augment', done, total } }))
      extra.forEach((list, i) => list.forEach((f) => { x.push(f); y.push(cls(tr[i])) }))
    }
    setState({ progress: null })
    const result = await train({ x, y }, { x: val.map((s) => feats.get(s.id)!), y: val.map(cls) }, classes.length, cfg,
      (e) => setState((s) => ({ training: s.training && { ...s.training, epoch: e.epoch, live: [...s.training.live, e] } })),
      () => state.training?.stop ?? false)
    const id = `run-${Date.now().toString(36)}`
    const classifier: Classifier = { model: result.model, mode, classes, runId: id }
    setClassifier(classifier)
    const run: Run = {
      id, name: `#${state.runs.length + 1}`, createdAt: Date.now(), mode, experiment: state.experiment ?? undefined, config: cfg,
      data: { train: x.length, val: val.length, perClass: countBy(tr, (s) => classes[cls(s)]), wrongLabels: [...tr, ...val].filter((s) => isWrong(s, mode)).length, sources: countBy(pool, (s) => s.source) },
      history: result.history, seconds: result.seconds, backend: backendName(), threshold: state.threshold,
    }
    setState((s) => ({ runs: [...s.runs, run], currentRunId: id, training: null, modelVersion: s.modelVersion + 1, lineStats: emptyLineStats() }))
    await saveClassifier(classifier, 'current', run.name)
    await evaluate()
    return null
  } catch (e) {
    console.error(e); setState({ training: null, progress: null })
    return String(e)
  }
}
export const stopTraining = () => setState((s) => ({ training: s.training && { ...s.training, stop: true } }))

// ---------- evaluation ----------
export const heldOut = (s: State = state) => s.samples.filter((x) => x.pool !== 'dev' && !x.removed && x.truth !== null)

export function summaryFor(samples: Sample[], threshold: number): EvalSummary | undefined {
  const c = getClassifier(); if (!c) return undefined
  const rows = samples.filter((s) => predictions.has(s.id) && s.truth !== null)
  if (!rows.length) return undefined
  const p = rows.map((s) => predictions.get(s.id)!)
  const sum = summarize(p.map((q) => q.score), rows.map((s) => s.truth !== 'good'), threshold, p.map((q) => q.confidence))
  if (c.mode === 'advanced') sum.classAccuracy = rows.filter((s, i) => c.classes[p[i].top] === s.truth).length / rows.length
  return sum
}
function refreshRunSummaries() {
  const id = state.currentRunId; if (!id) return
  const all = heldOut(), t = state.threshold
  const stress: Partial<Record<StressKind, EvalSummary>> = {}
  for (const k of STRESS_KINDS) { const s = summaryFor(all.filter((x) => x.stress === k), t); if (s) stress[k] = s }
  const test = summaryFor(all.filter((x) => x.pool === 'test'), t)
  setState((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, test, stress, threshold: t } : r)), modelVersion: s.modelVersion + 1 }))
}
/** Runs the current model on every held-out image (test and stress sets). */
export async function evaluate() {
  const c = getClassifier(); if (!c) return
  const items = heldOut().filter((s) => !predictions.has(s.id))
  if (items.length) {
    const feats = await featuresFor(items.map(loadable), (done, total) => setState({ progress: { key: 'evaluate', done, total } }))
    const probs = await predict(c, items.map((s) => feats.get(s.id)!))
    items.forEach((s, i) => predictions.set(s.id, toPrediction(s.id, probs[i])))
  }
  setState({ progress: null })
  refreshRunSummaries()
}
export function setThreshold(threshold: number) { setState({ threshold }); if (predictions.size) refreshRunSummaries() }

export async function activateClassifier(c: Classifier, run?: Run) {
  setClassifier(c)
  setState((s) => ({ currentRunId: c.runId, mode: c.mode, runs: run && !s.runs.some((r) => r.id === run.id) ? [...s.runs, run] : s.runs, modelVersion: s.modelVersion + 1, lineStats: emptyLineStats() }))
  await saveClassifier(c, 'current', run?.name ?? c.runId)
  await evaluate()
}

// ---------- line ----------
export const setLine = (p: Partial<LineSettings>) => setState((s) => ({ line: { ...s.line, ...p } }))
export const updateLineStats = (f: (s: LineStats) => LineStats) => setState((s) => ({ lineStats: f(s.lineStats) }))
export function snapshotLineToRun() {
  setState((s) => ({ runs: s.runs.map((r) => (r.id === s.currentRunId ? { ...r, line: s.lineStats } : r)) }))
}
/** A camera frame from the line becomes an unlabelled training image (the feedback loop). */
export async function captureToDataset(canvas: HTMLCanvasElement, truth: ClassId | null): Promise<string> {
  const blob = canvasBlob(canvas, 0.92)
  const id = `line-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
  addSamples([{ id, source: 'line', pool: 'dev', group: id, truth, label: null, selected: true, removed: false, blob, meta: { background: 'station', lighting: state.line.lighting }, addedAt: Date.now() }])
  return id
}

// ---------- save / load / reset ----------
export async function exportDataset() {
  const custom = state.samples.filter((s) => s.blob && s.pool === 'dev')
  const images = await Promise.all(custom.map(async (s) => ({ ...s, blob: undefined, data: await blobToDataUrl(s.blob!) })))
  const photos = state.samples.filter((s) => s.url && s.pool === 'dev').map((s) => ({ id: s.id, label: s.label, selected: s.selected, removed: s.removed }))
  download('rybex-vision-dataset.json', JSON.stringify({ kind: 'rybex-vision-dataset', version: 1, mode: state.mode, photos, images }))
}
export async function importDataset(file: File): Promise<number> {
  const j = JSON.parse(await file.text())
  if (j.kind !== 'rybex-vision-dataset') throw new Error('not a dataset file')
  const photoState = new Map<string, { label: Label | null; selected: boolean; removed: boolean }>((j.photos ?? []).map((p: { id: string }) => [p.id, p]))
  const incoming: Sample[] = await Promise.all((j.images ?? []).map(async (im: Sample & { data: string }) => { const { data, ...rest } = im; return { ...rest, blob: await dataUrlToBlob(data) } }))
  const ids = new Set(incoming.map((s) => s.id))
  forgetFeatures([...ids])
  setState((s) => ({
    samples: [...s.samples.filter((x) => !ids.has(x.id)).map((x) => { const p = photoState.get(x.id); return p ? { ...x, label: p.label, selected: p.selected, removed: p.removed } : x }), ...incoming],
  }))
  return incoming.length + photoState.size
}
export function exportRuns(format: 'json' | 'csv') {
  const runs = state.runs
  if (format === 'json') return download('rybex-vision-experiments.json', JSON.stringify({ kind: 'rybex-vision-experiments', exportedAt: new Date().toISOString(), manualInspection: state.manual, runs }, null, 2))
  const cols = ['name', 'experiment', 'mode', 'train_images', 'val_images', 'wrong_labels', 'epochs', 'learning_rate', 'batch_size', 'augmentation', 'train_acc', 'val_acc', 'seconds', 'threshold', 'test_accuracy', 'test_precision', 'test_recall', 'test_f1', 'false_acceptance_rate', 'false_rejection_rate', ...STRESS_KINDS.map((k) => `stress_${k}_accuracy`)]
  const f = (n?: number) => (n === undefined || Number.isNaN(n) ? '' : n.toFixed(4))
  const rows = runs.map((r) => [r.name, r.experiment ?? '', r.mode, r.data.train, r.data.val, r.data.wrongLabels, r.history.acc.length, r.config.learningRate, r.config.batchSize, r.config.augment, f(r.history.acc.at(-1)), f(r.history.valAcc.at(-1)), r.seconds.toFixed(1), r.threshold, f(r.test?.accuracy), f(r.test?.precision), f(r.test?.recall), f(r.test?.f1), f(r.test?.far), f(r.test?.frr), ...STRESS_KINDS.map((k) => f(r.stress?.[k]?.accuracy))].join(','))
  download('rybex-vision-experiments.csv', [cols.join(','), ...rows].join('\n'), 'text/csv')
}
export const renameRun = (id: string, name: string) => setState((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, name } : r)) }))
export const deleteRun = (id: string) => setState((s) => ({ runs: s.runs.filter((r) => r.id !== id || r.id === s.currentRunId) }))
export const markSaved = (id: string, saved: boolean) => setState((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, saved } : r)) }))

export async function resetLab() {
  clearTimeout(saveTimer)
  setClassifier(null); clearFeatureCache(); persistedSamples.clear()
  await removeAllModels(); await dbWipe()
  location.reload()
}

/** Stable pseudo-random order for galleries. */
export const orderKey = (id: string) => hashString(id)
