/* Generic tests copied from rag-lab/web/src/rag/chunker.test.ts; knowledge-base tests below. */
import { describe, expect, it } from 'vitest'
import { kbDocuments } from '@/data/kb'
import { chunkText, normalizeConfig, splitUnits, estimateTokenCount } from './chunker'
import { chunkDocument, KB_CHUNK_SIZE, splitSections } from './indexer'
import { getTokenCounter } from './tokenizer'

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
  it('always makes progress even when overlap about chunk size', () => {
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


describe('knowledge base chunking (220 tokens, 40 overlap, headings first)', () => {
  it('splits a body at its ## headings and keeps the heading on every chunk', async () => {
    const count = await getTokenCounter()
    const body = '## Alpha\n' + 'Alpha sentence number one. '.repeat(60) + '\n\n## Beta\nShort beta text.'
    expect(splitSections({ title: 'T', body }).map((s) => s.heading)).toEqual(['Alpha', 'Beta'])
    const chunks = chunkDocument({ id: 'DOC-x', title: 'T', body }, count)
    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) expect(c.text.startsWith(`## ${c.section}\n\n`)).toBe(true)
    expect(chunks.filter((c) => c.section === 'Alpha').length).toBeGreaterThan(1)
    expect(chunks.at(-1)).toMatchObject({ section: 'Beta', text: '## Beta\n\nShort beta text.' })
    expect(chunks.map((c) => c.chunkId)).toEqual(chunks.map((_, i) => `DOC-x#${i}`))
  })

  for (const lang of ['en', 'pl'] as const) {
    it(`chunks every ${lang} document within the budget, never across sections`, async () => {
      const count = await getTokenCounter()
      for (const d of kbDocuments(lang)) {
        const sections = splitSections(d)
        const chunks = chunkDocument(d, count)
        expect(new Set(chunks.map((c) => c.section))).toEqual(new Set(sections.map((s) => s.heading)))
        for (const c of chunks) {
          expect(c.text.startsWith(`## ${c.section}\n\n`), c.chunkId).toBe(true)
          // the chunker budgets per sentence; joined text can tokenise slightly longer (more so in Polish)
          expect(c.tokens, c.chunkId).toBeLessThanOrEqual(KB_CHUNK_SIZE + (lang === 'pl' ? 25 : 10))
          const section = sections.find((s) => s.heading === c.section)!
          expect(section.content.includes(c.text.slice(c.section.length + 5)), c.chunkId).toBe(true)
        }
      }
    })
  }
})
