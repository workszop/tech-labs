/** Promise-based client for the compute Web Worker (tokenizer, chunking, PCA). */
import type { ChunkConfig } from './chunker'
import type { ChunkResult, ComputeRequest, ComputeResponse, PcaResult } from './workers/protocol'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./workers/compute.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<ComputeResponse>) => {
      const p = pending.get(ev.data.id)
      if (!p) return
      pending.delete(ev.data.id)
      if (ev.data.ok) p.resolve(ev.data.result)
      else p.reject(new Error(ev.data.error))
    }
    worker.onerror = (ev) => {
      for (const p of pending.values()) p.reject(new Error(ev.message || 'Compute worker failed'))
      pending.clear()
      worker = null
    }
  }
  return worker
}

function call<T>(req: ComputeRequest): Promise<T> {
  const id = ++seq
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    getWorker().postMessage({ ...req, id })
  })
}

export const compute = {
  countTokens: (texts: string[]) => call<number[]>({ type: 'countTokens', texts }),
  chunk: (docs: { id: string; text: string }[], config: ChunkConfig) => call<ChunkResult[]>({ type: 'chunk', docs, config }),
  tokenize: (text: string, max = 80) => call<{ id: number; text: string }[]>({ type: 'tokenize', text, max }),
  pca: (vectors: Float32Array[], extra: Float32Array[], components: number) =>
    call<PcaResult>({ type: 'pca', vectors, extra, components }),
}
