// Real training: a small neural-network classifier on top of frozen MobileNet features.
import * as tf from '@tensorflow/tfjs'
import type { History, Label, Mode, TrainConfig } from '../types'
import { FEATURES } from './features'

export interface Classifier {
  model: tf.LayersModel
  mode: Mode
  /** Output order of the network. Index 0 is always "good". */
  classes: Label[]
  runId: string
}

export interface TrainData { x: Float32Array[]; y: number[] }
export interface EpochInfo { epoch: number; acc: number; valAcc: number; loss: number; valLoss: number; seconds: number }

const tensor = (rows: Float32Array[]) => {
  const flat = new Float32Array(rows.length * FEATURES)
  rows.forEach((r, i) => flat.set(r, i * FEATURES))
  return tf.tensor2d(flat, [rows.length, FEATURES])
}

export function buildHead(nClasses: number, learningRate: number, seed: number): tf.LayersModel {
  const m = tf.sequential()
  m.add(tf.layers.dense({ inputShape: [FEATURES], units: 64, activation: 'relu', kernelInitializer: tf.initializers.glorotUniform({ seed }), kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }) }))
  m.add(tf.layers.dropout({ rate: 0.3, seed }))
  m.add(tf.layers.dense({ units: nClasses, activation: 'softmax', kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 1 }) }))
  m.compile({ optimizer: tf.train.adam(learningRate), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })
  return m
}

/** Trains the classifier. Every number passed to `onEpoch` comes from `model.fit`. */
export async function train(
  trainSet: TrainData, valSet: TrainData, nClasses: number, cfg: TrainConfig,
  onEpoch: (e: EpochInfo) => void, shouldStop: () => boolean,
): Promise<{ model: tf.LayersModel; history: History; seconds: number }> {
  const model = buildHead(nClasses, cfg.learningRate, cfg.seed)
  const x = tensor(trainSet.x), y = tf.oneHot(tf.tensor1d(trainSet.y, 'int32'), nClasses)
  const hasVal = valSet.x.length > 0
  const vx = hasVal ? tensor(valSet.x) : null, vy = hasVal ? tf.oneHot(tf.tensor1d(valSet.y, 'int32'), nClasses) : null
  let classWeight: Record<number, number> | undefined
  if (cfg.balance) {
    const counts = new Array<number>(nClasses).fill(0); trainSet.y.forEach((c) => counts[c]++)
    const present = counts.filter((c) => c > 0).length
    classWeight = {}; counts.forEach((c, i) => { classWeight![i] = c ? trainSet.y.length / (present * c) : 0 })
  }
  const history: History = { acc: [], valAcc: [], loss: [], valLoss: [] }
  const t0 = performance.now()
  try {
    await model.fit(x, y, {
      epochs: cfg.epochs, batchSize: cfg.batchSize, shuffle: true, classWeight,
      validationData: hasVal ? [vx!, vy!] : undefined, yieldEvery: 'never',
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const acc = Number(logs?.acc ?? 0), loss = Number(logs?.loss ?? 0)
          const valAcc = hasVal ? Number(logs?.val_acc ?? 0) : NaN, valLoss = hasVal ? Number(logs?.val_loss ?? 0) : NaN
          history.acc.push(acc); history.loss.push(loss); history.valAcc.push(valAcc); history.valLoss.push(valLoss)
          onEpoch({ epoch: epoch + 1, acc, valAcc, loss, valLoss, seconds: (performance.now() - t0) / 1000 })
          if (shouldStop()) model.stopTraining = true
          await tf.nextFrame()
        },
      },
    })
  } finally { tf.dispose([x, y, vx, vy].filter(Boolean) as tf.Tensor[]) }
  return { model, history, seconds: (performance.now() - t0) / 1000 }
}

/** Class probabilities for feature vectors. */
export async function predict(c: Classifier, feats: Float32Array[]): Promise<number[][]> {
  if (!feats.length) return []
  const out = tf.tidy(() => c.model.predict(tensor(feats)) as tf.Tensor2D)
  const data = await out.data(); out.dispose()
  const n = c.classes.length
  return feats.map((_, i) => Array.from(data.slice(i * n, (i + 1) * n)))
}
