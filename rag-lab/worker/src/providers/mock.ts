/**
 * Mock provider for local dev, tests and key-less workshops.
 *
 * - Embeddings (`mock-hash-embedding-256`): feature hashing of lowercase word
 *   unigrams + bigrams (light stemming, stop words dropped), FNV-1a into 256
 *   signed buckets, L2-normalised. Deterministic, and texts sharing words
 *   really are closer in cosine space.
 * - Chat (`mock-extractive-chat`): parses the excerpts back out of the exact
 *   messages built by buildChatMessages and returns the sentences with the
 *   largest overlap with the question, with [n] citations. It answers in the
 *   language of the prompt template (English or Polish).
 */
import type { ChatMessage, Lang } from '../../../shared/api-types'
import { PROMPT_TEMPLATES, detectPromptLang, estimateMessagesTokens, estimateTokens } from '../../../shared/prompt'
import { MOCK_CHAT_MODEL, MOCK_EMBEDDING_DIMENSIONS, MOCK_EMBEDDING_MODEL } from '../env'
import { ApiError } from '../http'
import type { ChatOptions, ChatResult, ChatStreamChunk, EmbedResult, Provider } from './types'

export const MOCK_PREFIX = '(Mock model — offline demo) '
export const MOCK_PREFIX_PL = '(Model testowy – demo offline) '

const MOCK_TEXT: Record<Lang, { prefix: string; noAccess: string; noAnswer: string }> = {
  en: {
    prefix: MOCK_PREFIX,
    noAccess:
      "I don't have access to Rybex's internal documents, so I can't answer questions about Rybex's own procedures, deadlines or people. " +
      'Switch to RAG mode so that relevant excerpts are retrieved and sent along with your question.',
    noAnswer: "The retrieved documents don't contain the answer to this question.",
  },
  pl: {
    prefix: MOCK_PREFIX_PL,
    noAccess:
      'Nie mam dostępu do wewnętrznych dokumentów Rybex, więc nie odpowiem na pytania o procedury, terminy ani pracowników tej firmy. ' +
      'Przełącz na tryb RAG, żeby aplikacja wyszukała pasujące fragmenty i wysłała je razem z pytaniem.',
    noAnswer: 'W znalezionych dokumentach nie ma odpowiedzi na to pytanie.',
  },
}

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
// language (the chat answer does, from the prompt template) pass it explicitly.

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

interface Excerpt {
  n: number
  text: string
}

// The header line differs per language ("Source:" / "Źródło:"); the delimiters do not.
const EXCERPT_RE = /\[(\d+)\] [^\n]*\n<<<EXCERPT\n([\s\S]*?)\nEXCERPT>>>/g

function parsePrompt(messages: ChatMessage[]): { mode: 'rag' | 'no-rag'; lang: Lang; question: string; excerpts: Excerpt[] } {
  const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const detected = detectPromptLang(messages)
  if (detected?.mode === 'no-rag') return { mode: 'no-rag', lang: detected.lang, question: user, excerpts: [] }
  // Unknown system prompt: fall back to whichever question wrapper is present.
  const candidates: Lang[] = detected ? [detected.lang] : ['en', 'pl']
  for (const lang of candidates) {
    const marker = `\n---\n${PROMPT_TEMPLATES[lang].questionLabel} `
    const qIdx = user.lastIndexOf(marker)
    if (qIdx < 0) continue
    const excerpts: Excerpt[] = []
    for (const m of user.slice(0, qIdx).matchAll(EXCERPT_RE)) excerpts.push({ n: Number(m[1]), text: m[2]! })
    return { mode: 'rag', lang, question: user.slice(qIdx + marker.length), excerpts }
  }
  return { mode: 'rag', lang: detected?.lang ?? 'en', question: user, excerpts: [] }
}

function sentences(text: string, lang: Lang): string[] {
  // Polish text is full of mid-sentence abbreviations ("2026 r.", "np."), so a
  // Polish sentence only ends where the next one does not start with a lowercase letter.
  const boundary = lang === 'pl' ? /(?<=[.!?])\s+(?!\p{Ll})|\n+/u : /(?<=[.!?])\s+|\n+/
  return text
    .split(boundary)
    .map((s) => s.replace(/^[#>*\-\s]+/, '').trim())
    .filter((s) => s.length >= 3)
    // A chunk label ("[Title › Section · version …]", added in the browser) describes
    // the chunk; it is not a sentence of the document, so it is never quoted as an answer.
    .filter((s) => !/^\[[^\]]*\]$/.test(s))
}

export function mockAnswer(messages: ChatMessage[]): string {
  const { mode, lang, question, excerpts } = parsePrompt(messages)
  const txt = MOCK_TEXT[lang]
  if (mode === 'no-rag') return txt.prefix + txt.noAccess
  const noAnswer = txt.prefix + txt.noAnswer
  if (!excerpts.length) return noAnswer
  const q = new Set(terms(question, lang))
  if (!q.size) return noAnswer

  const scored: { n: number; order: number; text: string; score: number }[] = []
  let order = 0
  for (const ex of excerpts) {
    for (const s of sentences(ex.text, lang)) {
      const st = new Set(terms(s, lang))
      let score = 0
      for (const w of q) if (st.has(w)) score++
      scored.push({ n: ex.n, order: order++, text: s, score })
    }
  }
  const top = Math.max(0, ...scored.map((s) => s.score))
  // Keep only sentences that are about as relevant as the best one (≥ half its overlap).
  const threshold = Math.max(1, Math.ceil(top / 2))
  const best = scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order)
  if (!best.length) return noAnswer
  return txt.prefix + best.map((s) => `${/[.!?]$/.test(s.text) ? s.text : s.text + '.'} [${s.n}]`).join(' ')
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new ApiError('upstream_unavailable', 'The request was cancelled.'))
      },
      { once: true },
    )
  })
}

export class MockProvider implements Provider {
  readonly name = 'mock' as const
  readonly embeddingModel = MOCK_EMBEDDING_MODEL
  readonly chatModel = MOCK_CHAT_MODEL
  readonly embeddingDimensions = MOCK_EMBEDDING_DIMENSIONS
  constructor(private readonly streamDelayMs = 25) {}

  async embed(inputs: string[], _signal?: AbortSignal, lang?: Lang): Promise<EmbedResult> {
    return {
      model: this.embeddingModel,
      embeddings: inputs.map((t) => hashEmbedding(t, this.embeddingDimensions, lang)),
      inputTokens: inputs.reduce((n, t) => n + estimateTokens(t), 0),
    }
  }

  private answer(messages: ChatMessage[], opts: ChatOptions): ChatResult {
    let text = mockAnswer(messages)
    let finishReason = 'stop'
    const maxChars = opts.maxTokens * 4
    if (text.length > maxChars) {
      text = text.slice(0, maxChars)
      finishReason = 'length'
    }
    return {
      text,
      finishReason,
      usage: { inputTokens: estimateMessagesTokens(messages), outputTokens: estimateTokens(text) },
    }
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    return this.answer(messages, opts)
  }

  async *chatStream(messages: ChatMessage[], opts: ChatOptions, signal?: AbortSignal): AsyncGenerator<ChatStreamChunk> {
    const r = this.answer(messages, opts)
    const pieces = r.text.match(/\S+\s*/g) ?? [r.text]
    for (let i = 0; i < pieces.length; i += 3) {
      if (signal?.aborted) throw new ApiError('upstream_unavailable', 'The request was cancelled.')
      if (i > 0) await sleep(this.streamDelayMs, signal)
      yield { type: 'delta', text: pieces.slice(i, i + 3).join('') }
    }
    yield { type: 'finish', finishReason: r.finishReason, usage: r.usage }
  }
}
