import { describe, expect, it } from 'vitest'
import { fmtUsdAtLeast } from './common'
import { setSettings } from '@/state/store'

describe('fmtUsdAtLeast', () => {
  it('shows a tiny positive cost as "< 0,00001 USD" instead of zero', () => {
    setSettings({ lang: 'pl' })
    expect(fmtUsdAtLeast(0.0000033)).toBe('< 0,00001 USD')
    expect(fmtUsdAtLeast(0.002)).toBe('0,00200 USD')
    expect(fmtUsdAtLeast(0)).toBe('0,00 USD')
    setSettings({ lang: 'en' })
    expect(fmtUsdAtLeast(0.0000033)).toBe('< $0.00001')
  })
})
