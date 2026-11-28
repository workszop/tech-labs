import { describe, expect, it } from 'vitest'
import { chunkLabel, findSections, labelKey, sectionAt } from './chunkHeader'
import { chunkText } from './chunker'
import { PL_DOCUMENTS } from '@/data/pl'
import { getTokenCounter } from './tokenizer'

const W = { version: 'wersja', effectiveFrom: 'obowiązuje od', current: 'aktualny', outdated: 'NIEAKTUALNY', draft: 'PROJEKT, NIEZATWIERDZONY', owner: 'właściciel' }
const doc = (id: string) => PL_DOCUMENTS.find((d) => d.id === id)!
const p04 = doc('proces-04')
const draft = doc('proces-04-v6')
const arch = doc('arch-01')

describe('findSections', () => {
  it('finds one-line headings, skips the title, list items and sentences', () => {
    const text = 'Title\n\nIntro sentence.\n\nFirst heading\n\nBody.\n\n- list item\n\nLead-in line:\n- a\n\nSecond heading\n\nMore.'
    expect(findSections(text).map((s) => s.title)).toEqual(['First heading', 'Second heading'])
  })
  it('finds the food-safety section of the complaints procedure', () => {
    const titles = findSections(p04.content).map((s) => s.title)
    expect(titles).toContain('Zagrożenie bezpieczeństwa żywności')
    expect(titles).not.toContain('Obsługa reklamacji')
  })
})

describe('sectionAt', () => {
  it('returns the last heading at or before a position', () => {
    const secs = [{ start: 10, title: 'A' }, { start: 50, title: 'B' }]
    expect(sectionAt(secs, 5)).toBeNull()
    expect(sectionAt(secs, 10)?.title).toBe('A')
    expect(sectionAt(secs, 49)?.title).toBe('A')
    expect(sectionAt(secs, 80)?.title).toBe('B')
  })
})

describe('chunkLabel', () => {
  it('is empty when both options are off', () => {
    expect(chunkLabel(p04, [], 0, { section: false, meta: false }, W)).toBe('')
    expect(labelKey({ section: false, meta: false })).toBe('none')
    expect(labelKey({ section: true, meta: true })).toBe('section+meta')
  })
  it('at the default 400/60 the action paragraph is cut away from its rule, and the label puts the section back', async () => {
    const text = p04.content
    const chunks = chunkText(text, { chunkSize: 400, overlap: 60 }, await getTokenCounter())
    const action = chunks.find((c) => c.text.includes('w ciągu 24 godzin'))!
    expect(action.text).toContain('W takim przypadku')
    expect(action.text).not.toContain('potencjalne zagrożenie') // the rule is in the previous chunk
    const label = chunkLabel(p04, findSections(text), action.start, { section: true, meta: false }, W)
    expect(label).toBe('[Obsługa reklamacji › Zagrożenie bezpieczeństwa żywności]')
  })
  it('marks every chunk of the draft as not approved and every chunk of the archive as outdated', async () => {
    const count = await getTokenCounter()
    const d12 = chunkText(draft.content, { chunkSize: 60, overlap: 0 }, count).find((c) => c.text.includes('12 godzin'))!
    expect(d12.text).not.toContain('PROJEKT')
    expect(chunkLabel(draft, findSections(draft.content), d12.start, { section: false, meta: true }, W)).toBe('[Obsługa reklamacji – projekt wersji 6 · wersja 6 · obowiązuje od 2026-11-02 · PROJEKT, NIEZATWIERDZONY · właściciel: obsługa reklamacji]')
    const a60 = chunkText(arch.content, { chunkSize: 120, overlap: 0 }, count).find((c) => c.text.includes('60 minut'))!
    expect(a60.text).not.toContain('ARCHIWALNA')
    expect(chunkLabel(arch, findSections(arch.content), a60.start, { section: false, meta: true }, W)).toContain('NIEAKTUALNY')
  })
  it('does not repeat a heading that the chunk already contains', () => {
    const text = 'Title\n\nHeading\n\nBody text.'
    const secs = findSections(text)
    expect(chunkLabel(p04, secs, text.indexOf('Heading'), { section: true, meta: false }, W)).toBe('[Obsługa reklamacji]')
    expect(chunkLabel(p04, secs, text.indexOf('Body'), { section: true, meta: false }, W)).toBe('[Obsługa reklamacji › Heading]')
  })
})
