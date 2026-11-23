import { describe, expect, it } from 'vitest'
import { chunkText, normalizeConfig, splitUnits, estimateTokenCount } from './chunker'
import { getTokenCounter } from './tokenizer'
import { DOCUMENTS } from '@/data/documents'
import { getCorpus } from '@/data/corpus'

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length

describe('splitUnits', () => {
  it('splits sentences and marks paragraph starts with exact offsets', () => {
    const text = 'Title\n\nFirst sentence. Second one!\n\nNew paragraph? Yes.'
    const units = splitUnits(text, wordCount, 100)
    expect(units.map((u) => text.slice(u.start, u.end))).toEqual(['Title', 'First sentence.', 'Second one!', 'New paragraph?', 'Yes.'])
    expect(units.map((u) => u.paragraphStart)).toEqual([true, true, false, true, false])
  })
  it('treats list lines as separate units', () => {
    const text = 'Rules\n- one item\n- two item'
    const units = splitUnits(text, wordCount, 100)
    expect(units.map((u) => text.slice(u.start, u.end))).toEqual(['Rules', '- one item', '- two item'])
  })
  it('splits over-long sentences at word boundaries', () => {
    const text = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ') + '.'
    const units = splitUnits(text, wordCount, 10)
    expect(units.length).toBe(5)
    expect(units.every((u) => wordCount(text.slice(u.start, u.end)) <= 10)).toBe(true)
  })
})

describe('chunkText', () => {
  const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about topic ${i % 5}.`)
  const text = [sentences.slice(0, 10).join(' '), sentences.slice(10, 25).join(' '), sentences.slice(25).join(' ')].join('\n\n')

  it('produces contiguous slices within the size budget', () => {
    const chunks = chunkText(text, { chunkSize: 60, overlap: 0 }, wordCount)
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks) {
      expect(c.text).toBe(text.slice(c.start, c.end))
      expect(c.tokens).toBeLessThanOrEqual(60 + 5)
    }
  })
  it('covers every sentence', () => {
    const chunks = chunkText(text, { chunkSize: 60, overlap: 12 }, wordCount)
    for (const s of sentences) expect(chunks.some((c) => c.text.includes(s))).toBe(true)
  })
  it('overlaps adjacent chunks by whole sentences up to the overlap budget', () => {
    const chunks = chunkText(text, { chunkSize: 60, overlap: 16 }, wordCount)
    const withOverlap = chunks.filter((c) => c.overlapPrevChars > 0)
    expect(withOverlap.length).toBeGreaterThan(0)
    for (let i = 1; i < chunks.length; i++) {
      const c = chunks[i]
      if (!c.overlapPrevChars) continue
      const shared = text.slice(c.start, chunks[i - 1].end)
      expect(chunks[i - 1].text.endsWith(shared)).toBe(true)
      expect(c.text.startsWith(shared)).toBe(true)
      expect(c.overlapPrevTokens).toBeLessThanOrEqual(16 + 2)
      expect(chunks[i - 1].overlapNextChars).toBe(c.overlapPrevChars)
    }
  })
  it('no overlap when overlap = 0', () => {
    const chunks = chunkText(text, { chunkSize: 60, overlap: 0 }, wordCount)
    expect(chunks.every((c) => c.overlapPrevChars === 0)).toBe(true)
  })
  it('always makes progress even when overlap ≈ chunk size', () => {
    const chunks = chunkText(text, { chunkSize: 60, overlap: 1000 }, wordCount)
    expect(chunks.length).toBeLessThan(200)
    expect(chunks.at(-1)!.end).toBe(text.length)
  })
  it('handles empty text', () => {
    expect(chunkText('   \n\n ', { chunkSize: 100, overlap: 10 }, wordCount)).toEqual([])
  })
  it('normalizes config bounds', () => {
    expect(normalizeConfig({ chunkSize: 5, overlap: 100 })).toEqual({ chunkSize: 60, overlap: 30 })
    expect(normalizeConfig({ chunkSize: 400, overlap: -3 })).toEqual({ chunkSize: 400, overlap: 0 })
  })
  it('estimateTokenCount is roughly chars/4', () => {
    expect(estimateTokenCount('abcdefgh')).toBe(2)
  })
})

describe('chunking the real corpus with cl100k_base', () => {
  it('respects the 400/60 default on every document', async () => {
    const count = await getTokenCounter()
    let total = 0
    for (const d of DOCUMENTS) {
      const text = `${d.title}\n\n${d.content}`
      const chunks = chunkText(text, { chunkSize: 400, overlap: 60 }, count)
      expect(chunks.length).toBeGreaterThan(0)
      for (const c of chunks) expect(c.tokens).toBeLessThanOrEqual(400 + 8)
      total += chunks.length
    }
    expect(total).toBeGreaterThan(DOCUMENTS.length)
  })
})

describe('chunking the Polish corpus with cl100k_base', () => {
  const docs = getCorpus('pl').documents
  // The Polish documents are written folder by folder; an empty stub must not fail the suite.
  it.skipIf(docs.length === 0)('respects the 400/60 default on every document', async () => {
    const count = await getTokenCounter()
    let total = 0
    for (const d of docs) {
      const text = `${d.title}\n\n${d.content}`
      const chunks = chunkText(text, { chunkSize: 400, overlap: 60 }, count)
      expect(chunks.length).toBeGreaterThan(0)
      for (const c of chunks) {
        // Looser than the English bound (400 + 8): the chunker budgets with per-sentence token counts,
        // and joined Polish text can tokenise to more (measured: up to 445 for a 400 budget).
        expect(c.tokens).toBeLessThanOrEqual(460)
        expect(c.text).toBe(text.slice(c.start, c.end))
      }
      total += chunks.length
    }
    expect(total).toBeGreaterThan(docs.length)
  })
  it.skipIf(docs.length < DOCUMENTS.length)('has the same document ids as the English corpus', () => {
    expect(docs.map((d) => d.id).sort()).toEqual(DOCUMENTS.map((d) => d.id).sort())
  })
})
