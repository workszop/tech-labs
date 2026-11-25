// Shared types of the RYBEX Vision Lab.

export const CLASSES = ['good', 'dent', 'lid', 'label_missing', 'label_wrong', 'label_damaged', 'marking'] as const
export type ClassId = (typeof CLASSES)[number]
/** A user label: a specific class, or the generic "defective" of the basic (binary) mode. */
export type Label = ClassId | 'defect'
export type Mode = 'basic' | 'advanced'
export type Source = 'photo' | 'synthetic' | 'upload' | 'line'
/** dev = may be used for training and validation; test = held out; stress = held-out hard cases. */
export type Pool = 'dev' | 'test' | 'stress'
export const STRESS_KINDS = ['lighting', 'packaging', 'angle', 'occluded', 'subtle', 'glare'] as const
export type StressKind = (typeof STRESS_KINDS)[number]

export const DESIGNS = ['szprot', 'makrela', 'sledz', 'tunczyk'] as const
export type Design = (typeof DESIGNS)[number]
export const LIGHTINGS = ['normal', 'dim', 'warm', 'harsh'] as const
export type Lighting = (typeof LIGHTINGS)[number]
export const BACKGROUNDS = ['station', 'booth', 'steel', 'tray'] as const
export type Background = (typeof BACKGROUNDS)[number]

export interface SampleMeta {
  lighting?: Lighting
  background?: Background
  design?: Design | 'photo_red'
  elevation?: number
  yaw?: number
  severity?: number
  /** Deliberately unusable image seeded into the first batch (blur, glare, empty frame, cut off). */
  lowQuality?: boolean
}

export interface Sample {
  id: string
  source: Source
  pool: Pool
  stress?: StressKind
  /** One physical tin or one synthetic scene. Every image of a group stays in one split. */
  group: string
  /** Reference label (from the data provider or the generator). null = nobody knows (uploads, empty frames). */
  truth: ClassId | null
  /** The label the student assigned. */
  label: Label | null
  selected: boolean
  removed: boolean
  /** Static URL (bundled photos) ... */
  url?: string
  /** ... or image bytes (synthetic, uploads, line captures). */
  blob?: Blob
  meta: SampleMeta
  addedAt: number
}

export interface TrainConfig {
  epochs: number
  learningRate: number
  batchSize: number
  valSplit: number
  augment: boolean
  /** 0 = use every selected, labelled image. */
  maxImages: number
  balance: boolean
  seed: number
}

export interface EvalSummary {
  n: number
  good: number
  defective: number
  tp: number; fp: number; tn: number; fn: number
  accuracy: number
  precision: number
  recall: number
  f1: number
  /** False acceptance rate: share of defective products that are accepted. */
  far: number
  /** False rejection rate: share of good products that are rejected. */
  frr: number
  meanConfidence: number
  /** Advanced mode only: share of images whose exact class was predicted. */
  classAccuracy?: number
}

export interface History { acc: number[]; valAcc: number[]; loss: number[]; valLoss: number[] }

export interface Run {
  id: string
  name: string
  createdAt: number
  mode: Mode
  experiment?: string
  config: TrainConfig
  data: { train: number; val: number; perClass: Record<string, number>; wrongLabels: number; sources: Record<string, number> }
  history: History
  seconds: number
  backend: string
  threshold: number
  test?: EvalSummary
  stress?: Partial<Record<StressKind, EvalSummary>>
  line?: LineStats
  saved?: boolean
}

export interface LineSettings {
  running: boolean
  /** Tins per minute. */
  speed: number
  /** Percent of tins produced with a defect. */
  defectRate: number
  lighting: Lighting
  elevation: number
  pan: number
  designs: Design[]
  yawJitter: number
  human: boolean
  /** Half-width of the uncertain zone around the threshold that goes to a person. */
  band: number
}

export interface LineStats {
  inspected: number
  /** Good accepted / defective rejected / defective accepted / good rejected. */
  tn: number; tp: number; fn: number; fp: number
  reviewGood: number
  reviewDefective: number
  /** Tins that passed the rejector before the model answered. */
  uninspected: number
  uninspectedDefective: number
  inferenceMsSum: number
  inferenceCount: number
  startedAt: number
  activeMs: number
}

export interface BusinessConfig {
  dailyVolume: number
  productValue: number
  falseRejectCost: number
  complaintCost: number
  manualCost: number
  defectPct: number
  source: 'line' | 'test'
}

export interface ManualResult {
  total: number
  correct: number
  falseAccept: number
  falseReject: number
  defective: number
  good: number
  avgMs: number
}

export interface Prediction {
  id: string
  probs: number[]
  /** 1 - P(good): how sure the model is that the product is defective. */
  score: number
  /** Index of the most probable class. */
  top: number
  confidence: number
}
