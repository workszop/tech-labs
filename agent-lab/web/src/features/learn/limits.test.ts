import { describe, expect, it } from 'vitest'
import { learn as en } from '@/i18n/en/learn'
import { learn as pl } from '@/i18n/pl/learn'
import { DEFAULT_LIMITS, fillLimits } from './limits'

describe('run limits in the explanations (fix round 1)', () => {
  it('uses the session limits without "by default", and the defaults with it', () => {
    const tip = en.tips.steps.text
    expect(fillLimits(tip, { steps: 6, calls: 10, tokens: 30000, fromSession: true }, en.byDefault)).toContain('This lab stops a run after 6 steps.')
    expect(fillLimits(tip, DEFAULT_LIMITS, en.byDefault)).toContain('This lab by default stops a run after 8 steps.')
    const loop = fillLimits(pl.topics.loop.points[1]!, { steps: 6, calls: 10, tokens: 30000, fromSession: true }, pl.byDefault, 'pl-PL')
    expect(loop).toContain('Limit kroków na wiadomość to 6,')
    expect(loop).toMatch(/około 30\s000\./)
    expect(loop).toContain('wywołań narzędzi 10,')
    expect(loop).toContain('ostatni krok agent wykonuje już bez narzędzi')
    expect(loop).not.toContain('{')
  })

  it('says that every run limit ends with one last answer without tools (final fix finding 1)', () => {
    const loop = fillLimits(en.topics.loop.points[1]!, DEFAULT_LIMITS, en.byDefault)
    expect(loop).toContain('by default allows 8 steps, 12 tool calls and about 80,000 tokens')
    expect(loop).toContain('When one runs out, the agent takes one last step without tools')
  })
})
