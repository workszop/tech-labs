import type { ChunkConfig, TextChunk } from '../chunker'

export type ComputeRequest =
  | { type: 'countTokens'; texts: string[] }
  | { type: 'chunk'; docs: { id: string; text: string }[]; config: ChunkConfig }
  | { type: 'tokenize'; text: string; max?: number }
  | { type: 'pca'; vectors: number[][] | Float32Array[]; extra: (number[] | Float32Array)[]; components: number }

export type ComputeResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }

export interface ChunkResult {
  docId: string
  chunks: TextChunk[]
}
export interface PcaResult {
  points: number[][]
  extra: number[][]
  explainedVarianceRatio: number[]
}
