/**
 * Real BPE tokenizer: cl100k_base, the encoding used by OpenAI's
 * text-embedding-3-* models (and gpt-4 / gpt-3.5 class chat models).
 * The rank table is large (~1.7 MB of JS), so it is loaded lazily — in the
 * compute Web Worker, never on the main thread.
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

/** Token ids + their text pieces, for the "what is a token?" explainer. */
export async function tokenizeForDisplay(text: string, max = 80) {
  const enc = await loadTokenizer()
  const ids = enc.encode(text).slice(0, max)
  return ids.map((id) => ({ id, text: enc.decode([id]) }))
}
