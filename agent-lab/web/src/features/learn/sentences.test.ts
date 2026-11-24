import { describe, expect, it } from 'vitest'
import { learn as en } from '@/i18n/en/learn'
import { learn as pl } from '@/i18n/pl/learn'

describe('compare sentences (fix round 1)', () => {
  it('pl: the relative pronoun agrees with the number (1 / 2 / 5)', () => {
    expect(pl.compare.onlyCount(1, 0)).toBe('Przebieg A wykonał 1 wywołanie, którego nie było w B.')
    expect(pl.compare.onlyCount(2, 0)).toBe('Przebieg A wykonał 2 wywołania, których nie było w B.')
    expect(pl.compare.onlyCount(5, 0)).toBe('Przebieg A wykonał 5 wywołań, których nie było w B.')
    expect(pl.compare.onlyCount(0, 1)).toBe('Przebieg B wykonał 1 wywołanie, którego nie było w A.')
    expect(pl.compare.onlyCount(1, 2)).toBe('Przebieg A wykonał 1 wywołanie, którego nie było w B; przebieg B wykonał 2 wywołania, których nie było w A.')
  })

  it('en: a side without extra calls is left out; none on either side says the runs made the same calls', () => {
    expect(en.compare.onlyCount(1, 0)).toBe('Run A made 1 call that run B did not.')
    expect(en.compare.onlyCount(0, 2)).toBe('Run B made 2 calls that run A did not.')
    expect(en.compare.onlyCount(1, 2)).toBe('Run A made 1 call that run B did not; run B made 2 calls that run A did not.')
    for (const d of [en, pl]) {
      expect(d.compare.onlyCount(0, 0)).not.toMatch(/\b0\b/)
      expect(d.compare.onlyCount(3, 0)).not.toMatch(/\b0\b/)
    }
  })
})
