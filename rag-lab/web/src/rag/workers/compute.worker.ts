/// <reference lib="webworker" />
import { chunkText, type ChunkConfig } from '../chunker'
import { fitPca, transformPca } from '../pca'
import { getTokenCounter, tokenizeForDisplay } from '../tokenizer'
import type { ComputeRequest, ComputeResponse } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

async function handle(req: ComputeRequest): Promise<unknown> {
  switch (req.type) {
    case 'countTokens': {
      const count = await getTokenCounter()
      return req.texts.map((t) => count(t))
    }
    case 'chunk': {
      const count = await getTokenCounter()
      const cfg: ChunkConfig = req.config
      return req.docs.map((d) => ({ docId: d.id, chunks: chunkText(d.text, cfg, count) }))
    }
    case 'tokenize':
      return tokenizeForDisplay(req.text, req.max)
    case 'pca': {
      const model = fitPca(req.vectors, req.components)
      return {
        points: req.vectors.map((v) => transformPca(model, v)),
        extra: req.extra.map((v) => transformPca(model, v)),
        explainedVarianceRatio: model.explainedVarianceRatio,
      }
    }
  }
}

ctx.onmessage = async (ev: MessageEvent<ComputeRequest & { id: number }>) => {
  const { id } = ev.data
  try {
    const result = await handle(ev.data)
    ctx.postMessage({ id, ok: true, result } satisfies ComputeResponse)
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies ComputeResponse)
  }
}
