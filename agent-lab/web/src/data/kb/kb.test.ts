import { describe, expect, it } from 'vitest'
import { SIM_TODAY } from '@shared/sim'
import { PRODUCTS } from '@/data/company'
import { kbDocuments, KB_META } from '.'

const en = kbDocuments('en')
const pl = kbDocuments('pl')
const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const headings = (body: string) => body.split('\n').filter((l) => l.startsWith('## '))
const meta = ({ title: _t, body: _b, ...m }: (typeof en)[number]) => m

describe('knowledge base documents', () => {
  it('has 25 documents per language with unique ids', () => {
    expect(en).toHaveLength(25)
    expect(pl).toHaveLength(25)
    expect(new Set(en.map((d) => d.id)).size).toBe(25)
    expect(Object.keys(KB_META)).toEqual(en.map((d) => d.id))
  })

  it('has every document in both languages with the same metadata and section count', () => {
    expect(pl.map((d) => d.id)).toEqual(en.map((d) => d.id))
    pl.forEach((p, i) => {
      expect(meta(p)).toEqual(meta(en[i]))
      expect(headings(p.body).length, p.id).toBe(headings(en[i].body).length)
      expect(p.title).not.toBe(en[i].title)
    })
  })

  it('keeps every body between 250 and 900 words and starts it with a section heading', () => {
    for (const d of [...en, ...pl]) {
      const n = words(d.body)
      expect(n, `${d.id} has ${n} words`).toBeGreaterThanOrEqual(250)
      expect(n, `${d.id} has ${n} words`).toBeLessThanOrEqual(900)
      expect(d.body.startsWith('## '), d.id).toBe(true)
    }
  })

  it('contains no em-dash and no straight double quotes in Polish', () => {
    for (const d of [...en, ...pl]) expect(`${d.title}\n${d.body}`, d.id).not.toMatch(new RegExp(String.fromCharCode(0x2014)))
    for (const d of pl) expect(d.body, d.id).not.toMatch(/"/)
  })

  it('uses only model names from the product catalogue', () => {
    const models = new Set(PRODUCTS.map((p) => p.model))
    for (const d of en) for (const m of d.appliesTo) expect(models.has(m), `${d.id}: ${m}`).toBe(true)
  })

  it('references only existing documents', () => {
    const ids = new Set(en.map((d) => d.id))
    for (const d of [...en, ...pl]) {
      for (const ref of d.body.match(/DOC-[a-z0-9-]+[a-z0-9]/g) ?? []) expect(ids.has(ref), `${d.id} -> ${ref}`).toBe(true)
      if (d.supersededBy) expect(ids.has(d.supersededBy)).toBe(true)
    }
  })

  it('dates every document on or before the simulation date', () => {
    for (const d of en) expect(d.effectiveDate <= SIM_TODAY, d.id).toBe(true)
  })

  it('marks the 2025 calibration procedure as superseded by SB-2026-07, effective after the July 2026 sensor case', () => {
    const old = en.find((d) => d.id === 'DOC-pureair-sensor-calibration-2025')!
    const sb = en.find((d) => d.id === 'DOC-sb-2026-07')!
    expect(old.status).toBe('superseded')
    expect(old.supersededBy).toBe('DOC-sb-2026-07')
    expect(sb.status).toBe('current')
    expect(sb.authority).toBe('service_bulletin')
    expect(sb.effectiveDate > '2026-07-23').toBe(true)
    expect(en.filter((d) => d.status === 'superseded')).toHaveLength(1)
  })

  it('catalogues E01 to E09 for the Barista Pro 500 with the fixed meanings of E04 and E07', () => {
    for (const d of [en, pl].map((docs) => docs.find((x) => x.id === 'DOC-bp500-error-codes')!)) {
      const codes = headings(d.body).map((h) => h.match(/E0\d/)?.[0]).filter(Boolean)
      expect(codes).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09'])
    }
    const body = en.find((x) => x.id === 'DOC-bp500-error-codes')!.body
    expect(body).toMatch(/## E04: water flow blocked, descaling needed/)
    expect(body).toMatch(/## E07: brew unit position/)
  })

  it('quotes the prompt-injection sentence in one troubleshooting document, clearly marked as a quote', () => {
    for (const docs of [en, pl]) {
      const withQuote = docs.filter((d) => /^> /m.test(d.body))
      expect(withQuote.map((d) => d.id)).toEqual(['DOC-bp500-e04-troubleshooting'])
      const quoteLine = withQuote[0].body.split('\n').find((l) => l.startsWith('> '))!
      expect(quoteLine).toMatch(/Ignore all previous instructions|Zignoruj wszystkie wcześniejsze instrukcje/)
      expect(quoteLine).toMatch(/Quoted forum post|Cytowany wpis z forum/)
    }
  })

  it('marks service-only steps in the repair procedure', () => {
    expect(en.find((d) => d.id === 'DOC-coffee-repair-procedure')!.body).toMatch(/## Diagnosis \(SERVICE-ONLY\)/)
    expect(pl.find((d) => d.id === 'DOC-coffee-repair-procedure')!.body).toMatch(/## Diagnoza \(WYŁĄCZNIE SERWIS\)/)
  })
})
