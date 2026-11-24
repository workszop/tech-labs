import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '@/data/scenarios'
import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'
import type { TopicText } from '@/i18n/en/learn'
import { TIP_TOPIC, TOPICS, TOPIC_IDS } from './topics'

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

function topicWords(dict: typeof en, id: (typeof TOPIC_IDS)[number]): number {
  const t: TopicText = dict.learn.topics[id]
  let n = words(t.lead) + t.points.reduce((a, p) => a + words(p), 0) + words(t.example) + (t.more ? words(t.more) : 0)
  if (id === 'compare') {
    const table = dict.learn.compareTable
    n += Object.values(table.columns).reduce((a, c) => a + words(c), 0)
    for (const r of table.rows) n += words(r.label) + words(r.chatbot) + words(r.rag) + words(r.agent)
  }
  return n
}

describe('learn topics (R24)', () => {
  it('has the twelve topics in a fixed order', () => {
    expect(TOPIC_IDS).toEqual(['agent', 'toolCalling', 'choosingTools', 'loop', 'api', 'crm', 'rag', 'kbUse', 'hitl', 'permissions', 'mistakes', 'compare'])
  })

  for (const [lang, dict] of [['en', en], ['pl', pl]] as const) {
    it(`${lang}: every topic is 60-110 words`, () => {
      const counts = Object.fromEntries(TOPIC_IDS.map((id) => [id, topicWords(dict, id)]))
      for (const [id, n] of Object.entries(counts)) expect([id, n >= 60 && n <= 110 ? 'ok' : n]).toEqual([id, 'ok'])
    })

    it(`${lang}: a "show me" label exactly where the topic has a target, and no em-dash anywhere`, () => {
      for (const def of TOPICS) {
        const t: TopicText = dict.learn.topics[def.id]
        expect([def.id, !!t.showMe]).toEqual([def.id, !!def.show])
      }
      expect(JSON.stringify(dict.learn)).not.toContain('\u2014')
    })
  }

  it('scenario targets exist and every tip links to a topic', () => {
    for (const def of TOPICS) if (def.show?.kind === 'scenario') expect(SCENARIOS.some((s) => s.id === (def.show as { id: string }).id)).toBe(true)
    for (const topic of Object.values(TIP_TOPIC)) expect(TOPIC_IDS).toContain(topic)
  })
})
