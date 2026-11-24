/**
 * Test helpers for the knowledge base (imported only by *.test.ts files).
 *
 * `mockEmbed` behaves like the Worker's mock provider (`worker/src/providers/mock.ts`,
 * model `mock-hash-embedding-256`): feature hashing of word unigrams and bigrams
 * after light stemming and stop-word removal, FNV-1a into 256 signed buckets,
 * L2-normalised. The code is a trimmed copy (the web project cannot import Worker
 * sources), so test rankings reflect what the lab does without an API key.
 */
import type { Lang } from '@shared/api-types'
import type { EmbedFn } from './indexer'

export const MOCK_MODEL = 'mock-hash-embedding-256'
const DIMS = 256

const STOP_WORDS = new Set(
  (
    'a an the and or but if then else of to in on at by for with from into onto about as is are was were be been being ' +
    'do does did done have has had having it its this that these those there here what which who whom whose when where why how ' +
    'i me my we our you your he she they them their his her him us can could should would will shall may might must ' +
    'not no yes so than too very just also any all some each such only own same other more most much many ' +
    'up down out over under again further once per via vs etc'
  ).split(/\s+/),
)
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
const STEM_EXCEPTIONS_PL: Record<string, string> = {
  dzien: 'dni', tydzien: 'tygodn', lat: 'rok', lata: 'rok', latach: 'rok', pieniadze: 'pieniedz',
}
const SUFFIXES_PL: [string, string][] = [
  ['iami', ''], ['iach', ''], ['iego', ''], ['iemu', ''], ['dzie', 'd'],
  ['ami', ''], ['ach', ''], ['ego', ''], ['emu', ''], ['ymi', ''], ['imi', ''], ['ych', ''], ['ich', ''],
  ['owi', ''], ['iom', ''], ['iow', ''], ['iej', ''], ['iem', ''],
  ['icy', 'ik'], ['nci', 'nt'], ['cie', 't'], ['rze', 'r'],
  ['ow', ''], ['om', ''], ['em', ''], ['ej', ''], ['ym', ''], ['im', ''], ['ie', ''], ['ia', ''], ['iu', ''], ['io', ''], ['ii', ''],
  ['a', ''], ['e', ''], ['i', ''], ['o', ''], ['u', ''], ['y', ''],
]

function stem(w: string): string {
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

function stripSuffixPl(w: string): string {
  for (const [suffix, replacement] of SUFFIXES_PL) {
    if (w.endsWith(suffix) && w.length - suffix.length + replacement.length >= 3) return w.slice(0, -suffix.length) + replacement
  }
  return w
}

function stemPl(w: string): string {
  const irregular = STEM_EXCEPTIONS_PL[w]
  if (irregular) return irregular
  if (w.length <= 3 || /\d/.test(w)) return w
  let s = stripSuffixPl(stripSuffixPl(w))
  if (s.length > 4 && s.endsWith('ek')) s = s.slice(0, -2) + 'k'
  return s
}

function terms(text: string, lang: Lang): string[] {
  const words = text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[\p{L}\p{N}]+/gu)
  if (!words) return []
  if (lang === 'pl') return words.filter((w) => !STOP_WORDS_PL.has(w) && !STOP_WORDS.has(w)).map(stemPl)
  return words.filter((w) => !STOP_WORDS.has(w)).map(stem)
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function hashEmbedding(text: string, lang: Lang, dims = DIMS): number[] {
  const v = new Float64Array(dims)
  const t = terms(text, lang)
  const add = (feature: string, w: number) => {
    const sign = (fnv1a('#' + feature) & 1) === 0 ? 1 : -1
    v[fnv1a(feature) % dims] += sign * w
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

/** A counting embed stub. `model` names the model it answers with (default: the mock model). */
export function mockEmbed(model = MOCK_MODEL, dims = DIMS): EmbedFn & { calls: string[][] } {
  const calls: string[][] = []
  const fn = async (texts: string[], lang: Lang) => {
    calls.push(texts)
    return { model, embeddings: texts.map((t) => hashEmbedding(t, lang, dims)) }
  }
  return Object.assign(fn, { calls })
}
