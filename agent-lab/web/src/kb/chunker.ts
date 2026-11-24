/* Copied from rag-lab/web/src/rag/chunker.ts (unchanged); the knowledge base uses it through kb/indexer.ts with fixed settings. */
/**
 * Paragraph- and sentence-aware text chunking with token-based sizes.
 *
 * Every chunk is a contiguous slice [start, end) of the original document, so
 * the UI can highlight a chunk inside its document and show exactly which
 * characters two neighbouring chunks share (the overlap).
 *
 * Algorithm
 * 1. Split the document into "units": sentences (and list lines), each with its
 *    character offsets and a flag saying whether it starts a new paragraph.
 *    Units longer than the chunk size are split further at word boundaries.
 * 2. Greedily pack units into a chunk until the next unit would exceed the
 *    token budget. If the chunk is already ≥ 70 % full and the next unit starts
 *    a new paragraph, close the chunk early so paragraphs stay together.
 * 3. Start the next chunk a few whole sentences back, so that the shared tail
 *    is at most `overlapTokens` tokens long.
 */

export interface ChunkConfig {
  chunkSize: number // target maximum tokens per chunk
  overlap: number // maximum tokens shared with the previous chunk
}

export interface TextChunk {
  index: number
  start: number
  end: number
  text: string
  tokens: number
  /** Number of characters at the beginning of this chunk that also belong to the previous chunk. */
  overlapPrevChars: number
  overlapPrevTokens: number
  /** Number of characters at the end of this chunk that also belong to the next chunk. */
  overlapNextChars: number
}

export interface Unit {
  start: number
  end: number
  tokens: number
  paragraphStart: boolean
}

export type CountTokens = (text: string) => number

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { chunkSize: 400, overlap: 60 }
export const CHUNK_LIMITS = { minSize: 60, maxSize: 1200, maxOverlapRatio: 0.5 }

export function normalizeConfig(cfg: ChunkConfig): ChunkConfig {
  const chunkSize = Math.round(Math.min(CHUNK_LIMITS.maxSize, Math.max(CHUNK_LIMITS.minSize, cfg.chunkSize)))
  const overlap = Math.round(Math.min(Math.floor(chunkSize * CHUNK_LIMITS.maxOverlapRatio), Math.max(0, cfg.overlap)))
  return { chunkSize, overlap }
}

const SENTENCE_RE = /[^.!?\n]*(?:[.!?]+(?:["'”’)\]]+)?(?=\s|$)|\n|$)/g

/** Split text into sentence units with offsets. Exported for tests. */
export function splitUnits(text: string, count: CountTokens, maxTokens: number): Unit[] {
  const units: Unit[] = []
  const paraRe = /\S[\s\S]*?(?=\n\s*\n|$)/g
  let pm: RegExpExecArray | null
  while ((pm = paraRe.exec(text))) {
    const pStart = pm.index
    const para = pm[0]
    let first = true
    SENTENCE_RE.lastIndex = 0
    let sm: RegExpExecArray | null
    while ((sm = SENTENCE_RE.exec(para))) {
      if (sm[0].length === 0) {
        SENTENCE_RE.lastIndex++
        if (SENTENCE_RE.lastIndex > para.length) break
        continue
      }
      const raw = sm[0]
      const lead = raw.length - raw.trimStart().length
      const body = raw.trim()
      if (!body) continue
      const s = pStart + sm.index + lead
      const e = s + body.length
      const tokens = count(body)
      if (tokens <= maxTokens) {
        units.push({ start: s, end: e, tokens, paragraphStart: first })
      } else {
        for (const piece of splitLong(text, s, e, count, maxTokens)) {
          units.push({ ...piece, paragraphStart: first })
          first = false
        }
      }
      first = false
    }
  }
  return units
}

/** Split an over-long sentence at word boundaries into pieces of ≤ maxTokens. */
function splitLong(text: string, start: number, end: number, count: CountTokens, maxTokens: number) {
  const pieces: { start: number; end: number; tokens: number }[] = []
  const wordRe = /\S+/g
  const slice = text.slice(start, end)
  let pieceStart = -1
  let pieceEnd = -1
  let m: RegExpExecArray | null
  while ((m = wordRe.exec(slice))) {
    const ws = start + m.index
    const we = ws + m[0].length
    if (pieceStart < 0) {
      pieceStart = ws
      pieceEnd = we
      continue
    }
    if (count(text.slice(pieceStart, we)) > maxTokens) {
      pieces.push({ start: pieceStart, end: pieceEnd, tokens: count(text.slice(pieceStart, pieceEnd)) })
      pieceStart = ws
    }
    pieceEnd = we
  }
  if (pieceStart >= 0) pieces.push({ start: pieceStart, end: pieceEnd, tokens: count(text.slice(pieceStart, pieceEnd)) })
  return pieces
}

export function chunkText(text: string, config: ChunkConfig, count: CountTokens): TextChunk[] {
  const { chunkSize, overlap } = normalizeConfig(config)
  const units = splitUnits(text, count, chunkSize)
  if (units.length === 0) return []

  const spans: { first: number; last: number }[] = []
  let i = 0
  while (i < units.length) {
    let j = i
    let sum = 0
    while (j < units.length) {
      const t = units[j].tokens + (j > i ? 1 : 0) // +1 ≈ the joining whitespace
      if (j > i && sum + t > chunkSize) break
      if (j > i && units[j].paragraphStart && sum >= chunkSize * 0.7) break
      sum += t
      j++
    }
    spans.push({ first: i, last: j - 1 })
    if (j >= units.length) break
    // Step back whole units so that the overlap is at most `overlap` tokens.
    let k = j
    let back = 0
    while (k - 1 > i && back + units[k - 1].tokens <= overlap) {
      back += units[k - 1].tokens + 1
      k--
    }
    i = Math.max(k, i + 1)
  }

  const chunks: TextChunk[] = spans.map((s, index) => {
    const start = units[s.first].start
    const end = units[s.last].end
    const chunkTextValue = text.slice(start, end)
    return { index, start, end, text: chunkTextValue, tokens: count(chunkTextValue), overlapPrevChars: 0, overlapPrevTokens: 0, overlapNextChars: 0 }
  })
  for (let n = 1; n < chunks.length; n++) {
    const prev = chunks[n - 1]
    const cur = chunks[n]
    if (cur.start < prev.end) {
      cur.overlapPrevChars = prev.end - cur.start
      cur.overlapPrevTokens = count(text.slice(cur.start, prev.end))
      prev.overlapNextChars = prev.end - cur.start
    }
  }
  return chunks
}

/** Cheap fallback tokenizer estimate (used until the real tokenizer has loaded). */
export const estimateTokenCount: CountTokens = (text) => Math.max(1, Math.round(text.length / 4))
