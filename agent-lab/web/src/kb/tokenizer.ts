/**
 * Real BPE tokenizer (cl100k_base), copied from rag-lab/web/src/rag/tokenizer.ts.
 * The rank table is large (about 1.7 MB of JS), so it is loaded lazily. RAG Lab
 * runs it in a Web Worker; the service knowledge base is small (50 documents),
 * so here it runs on the main thread, once per session.
 */
import type { CountTokens } from './chunker'

export const TOKENIZER_NAME = 'cl100k_base'

let encoderPromise: Promise<{ encode: (t: string) => number[]; decode: (t: number[]) => string }> | null = null

export function loadTokenizer() {
  encoderPromise ??= (async () => {
    const [{ Tiktoken }, ranks] = await Promise.all([import('js-tiktoken/lite'), import('js-tiktoken/ranks/cl100k_base')])
    return new Tiktoken(ranks.default)
  })()
  return encoderPromise
}

export async function getTokenCounter(): Promise<CountTokens> {
  const enc = await loadTokenizer()
  const cache = new Map<string, number>()
  return (text: string) => {
    let n = cache.get(text)
    if (n === undefined) {
      n = enc.encode(text).length
      if (cache.size < 20000) cache.set(text, n)
    }
    return n
  }
}
