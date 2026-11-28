import { describe, expect, it } from 'vitest'
import { MAX_INSTRUCTIONS_CHARS, PROMPT_TEMPLATES, RAG_SYSTEM_PROMPT, RAG_SYSTEM_PROMPT_PL, buildChatMessages } from '@shared/prompt'
import type { ContextChunk } from '@shared/api-types'

const context: ContextChunk[] = [{ chunkId: 'a#0', documentTitle: 'Regulamin', folder: 'own', text: 'Urlop: 26 dni.' }]
const base = { question: 'Ile dni urlopu?', context, mode: 'rag' as const }

describe('buildChatMessages profile own', () => {
  it('keeps the Rybex prompt when no profile is given', () => {
    const m = buildChatMessages({ ...base, lang: 'pl' })
    expect(m[0].content).toBe(RAG_SYSTEM_PROMPT_PL)
    expect(buildChatMessages({ ...base, lang: 'en', profile: 'rybex' })[0].content).toBe(RAG_SYSTEM_PROMPT)
  })

  it('uses a generic system prompt for own documents', () => {
    for (const lang of ['pl', 'en'] as const) {
      const sys = buildChatMessages({ ...base, lang, profile: 'own' })[0].content
      expect(sys).not.toContain('Rybex')
      expect(sys).toContain('[1]')
    }
    expect(buildChatMessages({ ...base, lang: 'en', profile: 'own' })[0].content).toContain('language of the question')
    expect(buildChatMessages({ ...base, lang: 'pl', profile: 'own' })[0].content).toContain('w języku pytania')
  })

  it('puts team instructions after the fixed rules, under a heading', () => {
    const sys = buildChatMessages({ ...base, lang: 'pl', profile: 'own', instructions: '  Odpowiadaj punktami.  ' })[0].content
    const heading = PROMPT_TEMPLATES.pl.instructionsHeading
    expect(sys.endsWith(`${heading}\nOdpowiadaj punktami.`)).toBe(true)
    expect(sys.indexOf('[1]')).toBeLessThan(sys.indexOf(heading))
  })

  it('ignores instructions for Rybex, for no-rag and when blank', () => {
    expect(buildChatMessages({ ...base, lang: 'pl', instructions: 'X' })[0].content).toBe(RAG_SYSTEM_PROMPT_PL)
    expect(buildChatMessages({ ...base, mode: 'no-rag', context: [], lang: 'pl', profile: 'own', instructions: 'X' })[0].content).not.toContain('X')
    expect(buildChatMessages({ ...base, lang: 'pl', profile: 'own', instructions: '   ' })[0].content).not.toContain(PROMPT_TEMPLATES.pl.instructionsHeading)
  })

  it('caps instructions at 2000 characters', () => {
    expect(MAX_INSTRUCTIONS_CHARS).toBe(2000)
  })
})
