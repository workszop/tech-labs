import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { CROCKFORD, generateCode, normalizeCode } from '../src/codes'
import worker from '../src/index'
import { hashEmbedding, looksPolish, mockAnswer, stem, stemPl, terms } from '../src/providers/mock'
import { parseSse } from '../src/providers/sse'
import {
  NO_RAG_SYSTEM_PROMPT,
  NO_RAG_SYSTEM_PROMPT_PL,
  RAG_SYSTEM_PROMPT,
  RAG_SYSTEM_PROMPT_PL,
  buildChatMessages,
  detectPromptLang,
  formatContext,
  getSystemPrompt,
} from '../../shared/prompt'
import { newSession, sampleContext, sampleContextPl } from './helpers'
import { sha256Hex } from '../src/crypto'

describe('access codes', () => {
  it('format RAG-XXXX-XXXX-XXXX-XXXX-XXXX with ≥ 100 bits of entropy', () => {
    const c = generateCode()
    expect(c).toMatch(/^RAG(-[0-9A-HJKMNP-TV-Z]{4}){5}$/)
    const symbols = c.replace(/^RAG-/, '').replace(/-/g, '').length
    expect(symbols * Math.log2(CROCKFORD.length)).toBeGreaterThanOrEqual(100)
  })

  it('symbols are roughly uniform (no modulo bias)', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 2000; i++) for (const ch of generateCode().slice(4).replace(/-/g, '')) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    expect(counts.size).toBe(32)
    for (const n of counts.values()) expect(n).toBeGreaterThan(900) // expected 1250
  })

  it('normalises input', () => {
    const body = 'ABCD0123EFGH4567JKMN'
    expect(normalizeCode('RAG-ABCD-0123-EFGH-4567-JKMN')).toBe(body)
    expect(normalizeCode(' rag abcd o123 efgh 4567 jkmn ')).toBe(body)
    expect(normalizeCode('abcd-0I23-efgh-4567-jkmn')).toBe(body)
    expect(normalizeCode('ABCDOL23EFGH4567JKMN')).toBe(body)
    expect(normalizeCode('RAG-ABCD-0123-EFGH-4567-JKMU')).toBeNull() // U is not Crockford
    expect(normalizeCode('RAG-ABCD')).toBeNull()
  })
})

describe('mock embeddings', () => {
  it('light stemming', () => {
    expect(stem('policies')).toBe('policy')
    expect(stem('working')).toBe('work')
    expect(stem('laptops')).toBe('laptop')
    expect(stem('approved')).toBe('approv')
  })

  it('deterministic, normalised, similar > unrelated', () => {
    const a = hashEmbedding('Laptops are replaced every three years')
    expect(hashEmbedding('Laptops are replaced every three years')).toEqual(a)
    expect(a).toHaveLength(256)
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0)
    expect(dot(a, a)).toBeCloseTo(1, 5)
    const b = hashEmbedding('How often is a laptop replaced?')
    const c = hashEmbedding('Vacation days roll over to next year')
    expect(dot(a, b)).toBeGreaterThan(dot(a, c))
    expect(hashEmbedding('!!!').some((v) => v !== 0)).toBe(true)
  })
})

describe('mock chat', () => {
  it('extractive with citations and the mock prefix', () => {
    const m = buildChatMessages({ question: 'How many days per week remote?', context: sampleContext, mode: 'rag' })
    const ans = mockAnswer(m)
    expect(ans.startsWith('(Mock model — offline demo) ')).toBe(true)
    expect(ans).toMatch(/three days per week\. \[1\]/)
    expect(ans).not.toContain('[2]')
  })
})

describe('prompt template languages', () => {
  it('English output is unchanged, with and without lang', () => {
    const m = buildChatMessages({ question: '  How many days?  ', context: sampleContext.slice(0, 1), mode: 'rag' })
    expect(m).toEqual(buildChatMessages({ question: 'How many days?', context: sampleContext.slice(0, 1), mode: 'rag', lang: 'en' }))
    expect(m[0]).toEqual({ role: 'system', content: RAG_SYSTEM_PROMPT })
    expect(RAG_SYSTEM_PROMPT.startsWith('You are the Northstar Technologies knowledge assistant inside RAG Lab, a teaching tool.\n\nAnswer the user')).toBe(true)
    expect(RAG_SYSTEM_PROMPT.endsWith('6. Keep the answer short and clear: a few sentences or a short list.')).toBe(true)
    expect(RAG_SYSTEM_PROMPT).toHaveLength(1027)
    expect(NO_RAG_SYSTEM_PROMPT).toHaveLength(493)
    expect(m[1]!.content).toBe(
      'Document excerpts:\n\n' +
        '[1] Source: Remote Work Policy — HR (chunk hr-remote-work#1)\n' +
        '<<<EXCERPT\nEmployees may work remotely up to three days per week. Remote work requires manager approval. The office is open from 8am to 6pm.\nEXCERPT>>>' +
        '\n\n---\nQuestion: How many days?',
    )
    expect(buildChatMessages({ question: 'q', context: [], mode: 'rag' })[1]!.content).toBe('Document excerpts:\n\n(No excerpts were retrieved.)\n\n---\nQuestion: q')
    expect(buildChatMessages({ question: ' q ', context: [], mode: 'no-rag' })).toEqual([
      { role: 'system', content: NO_RAG_SYSTEM_PROMPT },
      { role: 'user', content: 'q' },
    ])
  })

  it('Polish template: Polish system prompts and wrappers, same numbering and delimiters', () => {
    const m = buildChatMessages({ question: ' Ile dni urlopu? ', context: sampleContextPl, mode: 'rag', lang: 'pl' })
    expect(m[0]).toEqual({ role: 'system', content: RAG_SYSTEM_PROMPT_PL })
    expect(RAG_SYSTEM_PROMPT_PL).toContain('Odpowiadaj po polsku.')
    expect(RAG_SYSTEM_PROMPT_PL.match(/^\d\. /gm)).toHaveLength(6)
    expect(m[1]!.content).toBe(
      'Fragmenty dokumentów:\n\n' +
        `[1] Źródło: Zasady pracy zdalnej – Kadry (fragment hr-remote-work#1)\n<<<EXCERPT\n${sampleContextPl[0]!.text}\nEXCERPT>>>\n\n` +
        `[2] Źródło: Zasady urlopowe – Kadry (fragment hr-leave-policy#0)\n<<<EXCERPT\n${sampleContextPl[1]!.text}\nEXCERPT>>>` +
        '\n\n---\nPytanie: Ile dni urlopu?',
    )
    expect(formatContext(sampleContextPl, 'pl')).toContain('[2] Źródło: Zasady urlopowe')
    expect(buildChatMessages({ question: 'q', context: [], mode: 'rag', lang: 'pl' })[1]!.content).toBe(
      'Fragmenty dokumentów:\n\n(Nie znaleziono żadnych fragmentów.)\n\n---\nPytanie: q',
    )
    const noRag = buildChatMessages({ question: 'q', context: [], mode: 'no-rag', lang: 'pl' })
    expect(noRag).toEqual([
      { role: 'system', content: NO_RAG_SYSTEM_PROMPT_PL },
      { role: 'user', content: 'q' },
    ])
    expect(NO_RAG_SYSTEM_PROMPT_PL).toContain('po polsku')
    // No em dashes and no straight closing quotes in the Polish text.
    for (const text of [RAG_SYSTEM_PROMPT_PL, NO_RAG_SYSTEM_PROMPT_PL, m[1]!.content]) {
      expect(text).not.toContain('—')
      expect(text).not.toMatch(/„[^”"]*"/)
    }
  })

  it('accessors', () => {
    expect(getSystemPrompt('rag')).toBe(RAG_SYSTEM_PROMPT)
    expect(getSystemPrompt('no-rag', 'en')).toBe(NO_RAG_SYSTEM_PROMPT)
    expect(getSystemPrompt('rag', 'pl')).toBe(RAG_SYSTEM_PROMPT_PL)
    expect(getSystemPrompt('no-rag', 'pl')).toBe(NO_RAG_SYSTEM_PROMPT_PL)
    expect(detectPromptLang(buildChatMessages({ question: 'q', context: [], mode: 'rag', lang: 'pl' }))).toEqual({ lang: 'pl', mode: 'rag' })
    expect(detectPromptLang(buildChatMessages({ question: 'q', context: [], mode: 'no-rag' }))).toEqual({ lang: 'en', mode: 'no-rag' })
    expect(detectPromptLang([{ role: 'system', content: 'something else' }])).toBeNull()
  })
})

describe('Polish text in the mock provider', () => {
  it('guesses the language per text', () => {
    expect(looksPolish('Ile dni urlopu przysługuje pracownikom?')).toBe(true)
    expect(looksPolish('zwrot wydatkow dla pracownika')).toBe(true) // no diacritics, but "dla"
    expect(looksPolish('How many vacation days do employees get?')).toBe(false)
    expect(looksPolish('Laptops are replaced every three years')).toBe(false)
    expect(looksPolish('Employees in the NA region get ten days, to be approved by a manager')).toBe(false)
  })

  it('English terms are unchanged', () => {
    expect(terms('The policies were approved for ten laptops')).toEqual(['policy', 'approv', 'ten', 'laptop'])
    expect(terms('Remote working policy')).toEqual(['remote', 'work', 'policy'])
  })

  it('strips diacritics including ł and drops Polish stop words', () => {
    expect(terms('Czy to jest możliwe, że żółw się spóźnił?')).toEqual(['mozliw', 'zolw', 'spoznil'])
    expect(terms('Zgłoś to w ciągu 30 dni')).toEqual(['zglos', 'ciag', '30', 'dni'])
  })

  it('light Polish stemming brings word families together', () => {
    const families: string[][] = [
      ['zwrot', 'zwrotu', 'zwrotów', 'zwroty', 'zwrotem', 'zwrocie'],
      ['urlop', 'urlopu', 'urlopy', 'urlopów', 'urlopie', 'urlopami'],
      ['pracownik', 'pracownika', 'pracownicy', 'pracowników', 'pracownikom', 'pracownikami'],
      ['zdalna', 'zdalnej', 'zdalną', 'zdalne', 'zdalnego', 'zdalnym'],
      ['dodatek', 'dodatku', 'dodatki', 'dodatków', 'dodatkiem'],
      ['faktura', 'faktury', 'fakturę', 'fakturze', 'faktur', 'fakturami'],
      ['klient', 'klienta', 'klientów', 'klienci', 'kliencie', 'klientom'],
      ['zgłoszenie', 'zgłoszenia', 'zgłoszeń', 'zgłoszeniu', 'zgłoszeniami'],
      ['system', 'systemu', 'systemy', 'systemów', 'systemie', 'systemami'],
      ['dzień', 'dni', 'dnia', 'dniach', 'dniami'],
      ['budżet', 'budżetu', 'budżecie', 'budżety'],
      ['rok', 'roku', 'lata', 'lat'],
    ]
    for (const family of families) {
      const stems = new Set(family.map((w) => terms(w, 'pl')[0]))
      expect([...stems], family.join('/')).toHaveLength(1)
    }
    expect(stemPl('zwrotow')).toBe('zwrot')
    expect(stemPl('pracownicy')).toBe('pracownik')
    expect(stemPl('dodatek')).toBe('dodatk')
    expect(stemPl('750')).toBe('750')
    expect(stemPl('usd')).toBe('usd')
    // different words stay apart
    expect(stemPl('zwrot')).not.toBe(stemPl('urlop'))
    expect(stemPl('faktura')).not.toBe(stemPl('firma'))
  })

  it('Polish question and Polish chunk get comparable vectors', () => {
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i]!, 0)
    const q = hashEmbedding('Ile dni urlopu przysługuje pracownikowi?')
    const leave = hashEmbedding(sampleContextPl[1]!.text)
    const remote = hashEmbedding(sampleContextPl[0]!.text)
    expect(dot(q, leave)).toBeGreaterThan(dot(q, remote))
    const q2 = hashEmbedding('Ile dni można pracować zdalnie?')
    expect(dot(q2, remote)).toBeGreaterThan(dot(q2, leave))
  })

  it('never quotes a chunk label line as an answer sentence', () => {
    const labelled = [{ chunkId: 'hr-remote-work#22', documentTitle: 'Zasady pracy zdalnej', folder: 'Kadry', text: '[Zasady pracy zdalnej › Dodatek na biuro domowe · wersja 4.0 · aktualny]\n- jednorazowy dodatek na urządzenie biura domowego w wysokości 750 USD' }]
    const ans = mockAnswer(buildChatMessages({ question: 'Ile wynosi dodatek na biuro domowe?', context: labelled, mode: 'rag', lang: 'pl' }))
    expect(ans).toContain('750 USD')
    expect(ans).not.toContain('› Dodatek')
  })

  it('answers in Polish with citations and the Polish mock prefix', () => {
    const m = buildChatMessages({ question: 'Ile dni urlopu przysługuje w roku?', context: sampleContextPl, mode: 'rag', lang: 'pl' })
    const ans = mockAnswer(m)
    expect(ans.startsWith('(Model testowy – demo offline) ')).toBe(true)
    expect(ans).toContain('20 dni urlopu w roku. [2]')
    expect(ans).not.toContain('[1]')
    expect(ans).not.toContain('Mock model')

    const remote = mockAnswer(buildChatMessages({ question: 'Przez ile dni w tygodniu można pracować zdalnie?', context: sampleContextPl, mode: 'rag', lang: 'pl' }))
    expect(remote).toContain('trzy dni w tygodniu. [1]')
    // "2026 r." must not cut the sentence in two
    const dated = mockAnswer(buildChatMessages({ question: 'Od kiedy obowiązują zasady pracy zdalnej?', context: sampleContextPl, mode: 'rag', lang: 'pl' }))
    expect(dated).toContain('Zasady obowiązują od 1 marca 2026 r. we wszystkich biurach. [1]')
  })

  it('fixed Polish sentences: no documents, no answer', () => {
    const noRag = mockAnswer(buildChatMessages({ question: 'Jakie są zasady pracy zdalnej w Northstar?', context: [], mode: 'no-rag', lang: 'pl' }))
    expect(noRag).toMatch(/^\(Model testowy – demo offline\) Nie mam dostępu do wewnętrznych dokumentów Northstar Technologies/)
    const empty = mockAnswer(buildChatMessages({ question: 'Ile kosztuje parking?', context: [], mode: 'rag', lang: 'pl' }))
    expect(empty).toBe('(Model testowy – demo offline) W znalezionych dokumentach nie ma odpowiedzi na to pytanie.')
    const miss = mockAnswer(buildChatMessages({ question: 'Chromodynamika kwantowa?', context: sampleContextPl, mode: 'rag', lang: 'pl' }))
    expect(miss).toBe(empty)
  })
})

describe('SSE parser', () => {
  it('handles CR-only line endings, multi-line data and a final event without trailing blank line', async () => {
    const text = 'event: a\rdata: one\rdata: two\r\r:comment\n\nevent: b\ndata: {"x":1}'
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        const b = new TextEncoder().encode(text)
        for (let i = 0; i < b.length; i++) c.enqueue(b.slice(i, i + 1))
        c.close()
      },
    })
    const out = []
    for await (const ev of parseSse(stream)) out.push(ev)
    expect(out).toEqual([
      { event: 'a', data: 'one\ntwo' },
      { event: 'b', data: '{"x":1}' },
    ])
  })
})

describe('scheduled cleanup', () => {
  it('deletes long-expired sessions and stale rate-limit windows, keeps live ones', async () => {
    const live = await newSession()
    const old = await newSession()
    const oldId = await sha256Hex(old.token)
    const liveId = await sha256Hex(live.token)
    await env.DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE id = ?1').bind(oldId, Date.now() - 30 * 86_400_000).run()
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES ('stale-test', 1000, 5)").run()

    const ctx = createExecutionContext()
    await worker.scheduled(createScheduledController({ scheduledTime: Date.now(), cron: '17 3 * * *' }), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(await env.DB.prepare('SELECT id FROM sessions WHERE id = ?1').bind(oldId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM sessions WHERE id = ?1').bind(liveId).first()).not.toBeNull()
    expect(await env.DB.prepare("SELECT key FROM rate_limits WHERE key = 'stale-test'").first()).toBeNull()
  })
})
