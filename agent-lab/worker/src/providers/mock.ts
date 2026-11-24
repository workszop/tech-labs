/**
 * Mock provider for local dev, tests and key-less workshops.
 *
 * - Embeddings (`mock-hash-embedding-256`): feature hashing of lowercase word
 *   unigrams + bigrams (light stemming, stop words dropped), FNV-1a into 256
 *   signed buckets, L2-normalised. Deterministic, and texts sharing words
 *   really are closer in cosine space.
 * - Chat: none yet. The rule-based tool-calling stand-in for the agent
 *   endpoint arrives with Task 5.
 */
import { type Lang, estimateTokens } from '../../../shared/api-types'
import { MOCK_CHAT_MODEL, MOCK_EMBEDDING_DIMENSIONS, MOCK_EMBEDDING_MODEL } from '../env'
import type { EmbedResult, Provider } from './types'

const STOP_WORDS = new Set(
  (
    'a an the and or but if then else of to in on at by for with from into onto about as is are was were be been being ' +
    'do does did done have has had having it its this that these those there here what which who whom whose when where why how ' +
    'i me my we our you your he she they them their his her him us can could should would will shall may might must ' +
    'not no yes so than too very just also any all some each such only own same other more most much many ' +
    'up down out over under again further once per via vs etc'
  ).split(/\s+/),
)

export function stem(w: string): string {
  if (w.length <= 3) return w
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('sses')) return w.slice(0, -2)
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3)
  if (w.endsWith('edly') && w.length > 6) return w.slice(0, -4)
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('ly') && w.length > 5) return w.slice(0, -2)
  if (/(?:s|x|z|ch|sh)es$/.test(w) && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1)
  return w
}

// ---------------------------------------------------------------- Polish
//
// Language choice: the stemmer and stop-word list are picked PER TEXT, not per
// word. A text counts as Polish when it has a Polish diacritic or one of a few
// words that do not occur in English (`looksPolish`); everything else goes
// through the English path, which is unchanged. A per-word mix was rejected
// because Polish endings (-y, -e, -a, -em ...) would also be cut off English
// words and "policy" would stop matching "policies". Callers that know the
// language (the embeddings `lang` hint) pass it explicitly.

/** Polish stop words, already without diacritics (the form `terms` compares against). */
const STOP_WORDS_PL = new Set(
  (
    'i a o u w we z ze na do od po za pod nad bez dla przez przy oraz lub albo ani ale bo wiec czyli ' +
    'sie ze zeby aby gdy jesli jezeli jak jako czy co kto ile kiedy gdzie tak nie to tu tam juz tez tylko bardzo ' +
    'ten ta te tego tej tym tych temu ktory ktora ktore ktorego ktorej ktorych ktorym jaki jaka jakie ' +
    'jest sa byc byl byla bylo byly bedzie beda ma maja mam moze moga mozna ' +
    'ja ty on ona ono oni one my wy go mu im ich jej jego mnie mi nas nam was wam swoj swoja swoje ' +
    'kazdy kazda kazde wszystkie itd np tzn'
  ).split(/\s+/),
)

/** Words that give a text away as Polish even when it was typed without diacritics. */
const POLISH_MARKERS = new Set(
  'sie jest nie czy dla oraz lub przez przy jak ile jaki jaka jakie ktory ktora ktore kiedy gdzie albo jesli tylko moze mozna'.split(' '),
)

const POLISH_DIACRITICS = /[ąćęłńóśźż]/

export function looksPolish(text: string): boolean {
  const lower = text.toLowerCase()
  if (POLISH_DIACRITICS.test(lower)) return true
  return (lower.match(/[a-z]+/g) ?? []).some((w) => POLISH_MARKERS.has(w))
}

/** Irregular forms that suffix stripping cannot bring together. */
const STEM_EXCEPTIONS_PL: Record<string, string> = {
  dzien: 'dni',
  tydzien: 'tygodn',
  lat: 'rok',
  lata: 'rok',
  latach: 'rok',
  pieniadze: 'pieniedz',
}

/** [ending, replacement], longest first. Input has no diacritics. */
const SUFFIXES_PL: [string, string][] = [
  ['iami', ''], ['iach', ''], ['iego', ''], ['iemu', ''], ['dzie', 'd'],
  ['ami', ''], ['ach', ''], ['ego', ''], ['emu', ''], ['ymi', ''], ['imi', ''], ['ych', ''], ['ich', ''],
  ['owi', ''], ['iom', ''], ['iow', ''], ['iej', ''], ['iem', ''],
  ['icy', 'ik'], ['nci', 'nt'], ['cie', 't'], ['rze', 'r'],
  ['ow', ''], ['om', ''], ['em', ''], ['ej', ''], ['ym', ''], ['im', ''], ['ie', ''], ['ia', ''], ['iu', ''], ['io', ''], ['ii', ''],
  ['a', ''], ['e', ''], ['i', ''], ['o', ''], ['u', ''], ['y', ''],
]
const MIN_STEM_PL = 3

function stripSuffixPl(w: string): string {
  for (const [suffix, replacement] of SUFFIXES_PL) {
    if (w.endsWith(suffix) && w.length - suffix.length + replacement.length >= MIN_STEM_PL) {
      return w.slice(0, -suffix.length) + replacement
    }
  }
  return w
}

/**
 * Light Polish stemmer for word-overlap retrieval; not linguistically correct.
 * Expects a lowercase word without diacritics. Strips the longest known
 * inflectional ending, at most twice (systemami → system → syst, the same stem
 * as "system"), then drops the fleeting "e" (dodatek / dodatku → dodatk).
 */
export function stemPl(w: string): string {
  const irregular = STEM_EXCEPTIONS_PL[w]
  if (irregular) return irregular
  if (w.length <= MIN_STEM_PL || /\d/.test(w)) return w
  let s = stripSuffixPl(stripSuffixPl(w))
  if (s.length > 4 && s.endsWith('ek')) s = s.slice(0, -2) + 'k'
  return s
}

/**
 * Lowercase word stems without stop words. `lang` forces the stemmer; without
 * it the language is guessed from the text (see the comment above).
 */
export function terms(text: string, lang?: Lang): string[] {
  const words = text
    .toLowerCase()
    .replace(/ł/g, 'l') // "ł" has no NFKD decomposition
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[\p{L}\p{N}]+/gu)
  if (!words) return []
  if (lang ? lang === 'pl' : looksPolish(text)) {
    return words.filter((w) => !STOP_WORDS_PL.has(w) && !STOP_WORDS.has(w)).map(stemPl)
  }
  return words.filter((w) => !STOP_WORDS.has(w)).map(stem)
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function hashEmbedding(text: string, dims = MOCK_EMBEDDING_DIMENSIONS, lang?: Lang): number[] {
  const v = new Float64Array(dims)
  const t = terms(text, lang)
  const add = (feature: string, w: number) => {
    const h = fnv1a(feature)
    const sign = (fnv1a('#' + feature) & 1) === 0 ? 1 : -1
    v[h % dims]! += sign * w
  }
  for (let i = 0; i < t.length; i++) {
    add('u:' + t[i], 1)
    if (i + 1 < t.length) add(`b:${t[i]} ${t[i + 1]}`, 0.5)
  }
  if (t.length === 0) add('raw:' + text.trim().toLowerCase(), 1)
  let norm = 0
  for (const x of v) norm += x * x
  norm = Math.sqrt(norm) || 1
  return Array.from(v, (x) => Math.round((x / norm) * 1e7) / 1e7)
}

export class MockProvider implements Provider {
  readonly name = 'mock' as const
  readonly embeddingModel = MOCK_EMBEDDING_MODEL
  readonly chatModel = MOCK_CHAT_MODEL
  readonly embeddingDimensions = MOCK_EMBEDDING_DIMENSIONS

  async embed(inputs: string[], _signal?: AbortSignal, lang?: Lang): Promise<EmbedResult> {
    return {
      model: this.embeddingModel,
      embeddings: inputs.map((t) => hashEmbedding(t, this.embeddingDimensions, lang)),
      inputTokens: inputs.reduce((n, t) => n + estimateTokens(t), 0),
    }
  }
}
