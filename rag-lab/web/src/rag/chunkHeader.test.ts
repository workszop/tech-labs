import { describe, expect, it } from 'vitest'
import { chunkLabel, findSections, labelKey, sectionAt } from './chunkHeader'
import { chunkText } from './chunker'
import { HR } from '@/data/pl/hr'
import { getTokenCounter } from './tokenizer'

const W = { version: 'wersja', effectiveFrom: 'obowiązuje od', current: 'aktualny', outdated: 'NIEAKTUALNY', owner: 'właściciel' }
const remote = HR.find((d) => d.id === 'hr-remote-work')!
const remote2022 = HR.find((d) => d.id === 'hr-remote-work-2022')!

describe('findSections', () => {
  it('finds one-line headings, skips the title, list items and sentences', () => {
    const text = 'Title\n\nIntro sentence.\n\nFirst heading\n\nBody.\n\n- list item\n\nLead-in line:\n- a\n\nSecond heading\n\nMore.'
    expect(findSections(text).map((s) => s.title)).toEqual(['First heading', 'Second heading'])
  })
  it('finds the home-office section of the current remote-work policy', () => {
    const titles = findSections(remote.content).map((s) => s.title)
    expect(titles).toContain('Dodatek na biuro domowe')
    expect(titles).not.toContain('Zasady pracy zdalnej')
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
    expect(chunkLabel(remote, [], 0, { section: false, meta: false }, W)).toBe('')
    expect(labelKey({ section: false, meta: false })).toBe('none')
    expect(labelKey({ section: true, meta: true })).toBe('section+meta')
  })
  it('puts the section heading back on the chunk that holds the 750 USD item (120-token chunks, as in the app)', async () => {
    const text = remote.content
    const chunks = chunkText(text, { chunkSize: 120, overlap: 60 }, await getTokenCounter())
    const withAmount = chunks.find((c) => c.text.includes('750 USD'))!
    expect(withAmount.text).not.toContain('Dodatek na biuro domowe') // the heading was cut off
    const label = chunkLabel(remote, findSections(text), withAmount.start, { section: true, meta: false }, W)
    expect(label).toBe('[Zasady pracy zdalnej › Dodatek na biuro domowe]')
  })
  it('marks every chunk of the 2022 policy as outdated, not only its first paragraph', async () => {
    const text = remote2022.content
    const chunks = chunkText(text, { chunkSize: 120, overlap: 60 }, await getTokenCounter())
    const amount = chunks.find((c) => c.text.includes('300 USD'))!
    expect(amount.text).not.toContain('NIEAKTUALNE')
    const label = chunkLabel(remote2022, findSections(text), amount.start, { section: false, meta: true }, W)
    expect(label).toBe('[Zasady pracy zdalnej (2022, nieaktualne) · wersja 2.1 · obowiązuje od 2022-06-01 · NIEAKTUALNY · właściciel: People Operations]')
  })
  it('does not repeat a heading that the chunk already contains', () => {
    const text = 'Title\n\nHeading\n\nBody text.'
    const secs = findSections(text)
    expect(chunkLabel(remote, secs, text.indexOf('Heading'), { section: true, meta: false }, W)).toBe('[Zasady pracy zdalnej]')
    expect(chunkLabel(remote, secs, text.indexOf('Body'), { section: true, meta: false }, W)).toBe('[Zasady pracy zdalnej › Heading]')
  })
})
