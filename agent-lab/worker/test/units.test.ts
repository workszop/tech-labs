import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { CROCKFORD, generateCode, normalizeCode } from '../src/codes'
import worker from '../src/index'
import { hashEmbedding, looksPolish, stem, stemPl, terms } from '../src/providers/mock'
import { newSession, sampleContextPl } from './helpers'
import { sha256Hex } from '../src/crypto'

describe('access codes', () => {
  it('format AGT-XXXX-XXXX-XXXX-XXXX-XXXX with ≥ 100 bits of entropy', () => {
    const c = generateCode()
    expect(c).toMatch(/^AGT(-[0-9A-HJKMNP-TV-Z]{4}){5}$/)
    const symbols = c.replace(/^AGT-/, '').replace(/-/g, '').length
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
    expect(normalizeCode('AGT-ABCD-0123-EFGH-4567-JKMN')).toBe(body)
    expect(normalizeCode(' agt abcd o123 efgh 4567 jkmn ')).toBe(body)
    expect(normalizeCode('abcd-0I23-efgh-4567-jkmn')).toBe(body)
    expect(normalizeCode('ABCDOL23EFGH4567JKMN')).toBe(body)
    expect(normalizeCode('AGT-ABCD-0123-EFGH-4567-JKMU')).toBeNull() // U is not Crockford
    expect(normalizeCode('AGT-ABCD')).toBeNull()
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
})

describe('scheduled cleanup', () => {
  it('deletes long-expired sessions, old agent runs and stale rate-limit windows, keeps live ones', async () => {
    const live = await newSession()
    const old = await newSession()
    const oldId = await sha256Hex(old.token)
    const liveId = await sha256Hex(live.token)
    await env.DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE id = ?1').bind(oldId, Date.now() - 30 * 86_400_000).run()
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES ('stale-test', 1000, 5)").run()
    const oldRun = crypto.randomUUID()
    const liveRun = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO agent_runs (run_id, session_id, steps, tool_calls, tokens, created_at) VALUES (?1, ?2, 1, 0, 10, ?3), (?4, ?2, 1, 0, 10, ?5)')
      .bind(oldRun, liveId, Date.now() - 30 * 86_400_000, liveRun, Date.now())
      .run()

    const ctx = createExecutionContext()
    await worker.scheduled(createScheduledController({ scheduledTime: Date.now(), cron: '17 3 * * *' }), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(await env.DB.prepare('SELECT id FROM sessions WHERE id = ?1').bind(oldId).first()).toBeNull()
    expect(await env.DB.prepare('SELECT id FROM sessions WHERE id = ?1').bind(liveId).first()).not.toBeNull()
    expect(await env.DB.prepare("SELECT key FROM rate_limits WHERE key = 'stale-test'").first()).toBeNull()
    expect(await env.DB.prepare('SELECT run_id FROM agent_runs WHERE run_id = ?1').bind(oldRun).first()).toBeNull()
    expect(await env.DB.prepare('SELECT run_id FROM agent_runs WHERE run_id = ?1').bind(liveRun).first()).not.toBeNull()
  })
})
