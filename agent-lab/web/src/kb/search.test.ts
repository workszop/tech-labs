import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Lang } from '@shared/api-types'
import { kbDocuments } from '@/data/kb'
import { executeTool } from '@/sim/tools'
import { kbDb } from './db'
import { KB_EMBED_BATCH } from './indexer'
import { chunksOf, indexKnowledgeBase, indexStatus, KbNotReadyError, normalizeModel, searchKnowledge } from './search'
import { MOCK_MODEL, mockEmbed } from './test-utils'

beforeEach(async () => {
  await kbDb.vectors.clear()
  await kbDb.meta.clear()
})

const docsById = new Map(kbDocuments('en').map((d) => [d.id, d]))

async function expectNotReady(p: Promise<unknown>, reason: 'missing' | 'stale') {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(KbNotReadyError)
  expect((err as KbNotReadyError).code).toBe('index_not_ready')
  expect((err as KbNotReadyError).reason).toBe(reason)
}

describe('indexing', () => {
  it('embeds every chunk in batches of at most 32 and reports ready', async () => {
    const embed = mockEmbed()
    const progress: [number, number][] = []
    const info = await indexKnowledgeBase('en', embed, (d, t) => progress.push([d, t]))
    const chunks = (await Promise.all(kbDocuments('en').map((d) => chunksOf(d.id, 'en')))).flat()
    expect(info).toMatchObject({ lang: 'en', model: MOCK_MODEL, dimensions: 256, documents: 25, chunks: chunks.length, reused: 0 })
    expect(info.chunks).toBeGreaterThan(100)
    expect(embed.calls.every((c) => c.length <= KB_EMBED_BATCH)).toBe(true)
    expect(embed.calls.flat()).toHaveLength(info.embedded)
    expect(progress.at(-1)).toEqual([info.chunks, info.chunks])
    expect(await indexStatus('en', MOCK_MODEL)).toBe('ready')
    expect(await kbDb.vectors.get(['en', MOCK_MODEL, chunks[0].hash]).then((v) => v?.vector)).toBeInstanceOf(Float32Array)
  })

  it('makes zero embed calls when re-indexing unchanged content', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    const again = mockEmbed()
    const info = await indexKnowledgeBase('en', again)
    expect(again.calls).toHaveLength(0)
    expect(info.embedded).toBe(0)
    expect(info.reused).toBeGreaterThan(100)
    expect(await indexStatus('en', MOCK_MODEL)).toBe('ready')
  })

  it('re-indexes everything for a new embedding model and keeps the languages apart', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    const other = Object.assign(mockEmbed('other-model', 64), { model: 'other-model' })
    const info = await indexKnowledgeBase('en', other)
    expect(info.model).toBe('other-model')
    expect(info.reused).toBe(0)
    expect(await indexStatus('en', 'other-model')).toBe('ready')
    expect(await indexStatus('en', MOCK_MODEL)).toBe('stale')
    expect(await indexStatus('pl', 'other-model')).toBe('missing')
  })

  it('follows the model the Worker answers with when it differs from the expected one', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    // the caller expects the old model, but the Worker now answers with another one
    const embed = Object.assign(mockEmbed('switched-model', 32), { model: 'expected-model' })
    const info = await indexKnowledgeBase('en', embed)
    expect(info).toMatchObject({ model: 'switched-model', dimensions: 32, reused: 0 })
    expect(await indexStatus('en', 'switched-model')).toBe('ready')
    expect(await indexStatus('en', MOCK_MODEL)).toBe('stale')
  })

  it('leaves the index not ready when indexing is cancelled', async () => {
    const ctrl = new AbortController()
    const embed = Object.assign(mockEmbed(), { model: MOCK_MODEL })
    const run = indexKnowledgeBase('pl', embed, (done) => {
      if (done > 0) ctrl.abort()
    }, ctrl.signal)
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(await indexStatus('pl', MOCK_MODEL)).toBe('missing')
    // vectors embedded before the cancel are reused by the next run
    const resume = Object.assign(mockEmbed(), { model: MOCK_MODEL })
    const info = await indexKnowledgeBase('pl', resume)
    expect(info.reused).toBeGreaterThan(0)
    expect(await indexStatus('pl', MOCK_MODEL)).toBe('ready')
  })
})

describe('Review Focus 4: search refuses a missing or stale index', () => {
  it('throws index_not_ready (missing) before any embed call when the language was never indexed', async () => {
    const embed = mockEmbed()
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'en', embed }), 'missing')
    expect(embed.calls).toHaveLength(0)
    expect(await indexStatus('en', MOCK_MODEL)).toBe('missing')
  })

  it('throws missing when only the other language is indexed', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'pl', embed: mockEmbed() }), 'missing')
  })

  it('throws stale when the index was built with another embedding model', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    expect(await indexStatus('en', 'text-embedding-3-small')).toBe('stale')
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'en', embed: mockEmbed('text-embedding-3-small', 256) }), 'stale')
    const declared = Object.assign(mockEmbed('text-embedding-3-small'), { model: 'text-embedding-3-small' })
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'en', embed: declared }), 'stale')
    expect(declared.calls).toHaveLength(0)
  })

  it('throws stale when the documents changed after indexing', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    const meta = (await kbDb.meta.get('en'))!
    await kbDb.meta.put({ ...meta, corpusHash: 'older-documents' })
    expect(await indexStatus('en', MOCK_MODEL)).toBe('stale')
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'en', embed: mockEmbed() }), 'stale')
  })

  it('throws stale when stored vectors are missing', async () => {
    await indexKnowledgeBase('en', mockEmbed())
    const [first] = await kbDb.vectors.toCollection().primaryKeys()
    await kbDb.vectors.delete(first)
    expect(await indexStatus('en', MOCK_MODEL)).toBe('stale')
    await expectNotReady(searchKnowledge({ query: 'E04' }, { lang: 'en', embed: mockEmbed() }), 'stale')
  })

  it('reaches the agent as an index_not_ready tool error, not as empty matches', async () => {
    const embed = mockEmbed()
    const r = await executeTool('search_service_knowledge', { query: 'E04' }, {
      customerId: 'CUST-1042',
      lang: 'en',
      searchKnowledge: (a) => searchKnowledge(a, { lang: 'en', embed }),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('index_not_ready')
  })
})

describe('search', () => {
  const ready = async (lang: Lang) => {
    await indexKnowledgeBase(lang, mockEmbed())
    return mockEmbed()
  }

  it('returns the top 5 hits, best first, with scores rounded to 4 places and full metadata', async () => {
    const embed = await ready('en')
    const hits = await searchKnowledge({ query: 'How often should I replace the HEPA filter?' }, { lang: 'en', embed })
    expect(hits).toHaveLength(5)
    expect(hits.map((h) => h.score)).toEqual([...hits.map((h) => h.score)].sort((a, b) => b - a))
    for (const h of hits) {
      expect(Math.round(h.score * 1e4) / 1e4).toBe(h.score)
      const doc = docsById.get(h.docId)!
      expect(h).toMatchObject({ docTitle: doc.title, authority: doc.authority, status: doc.status, appliesTo: doc.appliesTo, effectiveDate: doc.effectiveDate })
      expect(h.text.startsWith(`## ${h.section}`)).toBe(true)
      expect(h.chunkId.startsWith(`${h.docId}#`)).toBe(true)
    }
    expect(embed.calls).toEqual([['How often should I replace the HEPA filter?']])
  })

  it('embeds query, product model and error code as one string', async () => {
    const embed = await ready('en')
    await searchKnowledge({ query: 'machine will not brew', productModel: 'Northstar Barista Pro 500', errorCode: 'E04' }, { lang: 'en', embed })
    expect(embed.calls).toEqual([['machine will not brew Northstar Barista Pro 500 E04']])
  })

  for (const [lang, query] of [
    ['en', 'E04 Barista Pro 500'],
    ['pl', 'E04 Barista Pro 500'],
    ['pl', 'Mój ekspres Barista Pro 500 pokazuje błąd E04 i nie parzy kawy'],
  ] as const) {
    it(`ranks a chunk of the E04 documents first for "${query}" (${lang})`, async () => {
      const embed = await ready(lang)
      const hits = await searchKnowledge({ query }, { lang, embed })
      expect(['DOC-bp500-e04-troubleshooting', 'DOC-bp500-error-codes']).toContain(hits[0].docId)
      expect(hits[0].text).toContain('E04')
    })
  }

  it('with productModel PureAir 300 returns no vacuum-only chunk and only matching or general documents', async () => {
    const embed = await ready('en')
    const vacuumModels = /AeroClean|RoboClean|CanisterMax/
    for (const query of ['battery lasts only a few minutes', 'brush motor error robot vacuum', 'S2 air quality number never changes']) {
      const hits = await searchKnowledge({ query, productModel: 'Northstar PureAir 300' }, { lang: 'en', embed })
      expect(hits.length).toBeGreaterThan(0)
      for (const h of hits) {
        expect(h.appliesTo.length === 0 || h.appliesTo.includes('Northstar PureAir 300'), h.docId).toBe(true)
        expect(h.appliesTo.length > 0 && h.appliesTo.every((m) => vacuumModels.test(m))).toBe(false)
      }
    }
    // without the filter the vacuum battery guide is what this question finds
    const unfiltered = await searchKnowledge({ query: 'battery lasts only a few minutes' }, { lang: 'en', embed })
    expect(unfiltered.map((h) => h.docId)).toContain('DOC-vacuum-battery-faults')
  })

  it('matches the product model case-insensitively, with or without the brand name', async () => {
    expect(normalizeModel('Northstar PureAir 300')).toBe(normalizeModel('  pureair   300 '))
    expect(normalizeModel('NORTHSTAR PUREAIR 300')).toBe('pureair 300')
    expect(normalizeModel('PureAir 3000')).not.toBe(normalizeModel('PureAir 300'))
    const embed = await ready('en')
    const hits = await searchKnowledge({ query: 'battery lasts only a few minutes', productModel: 'pureair 300' }, { lang: 'en', embed })
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) expect(h.appliesTo.length === 0 || h.appliesTo.includes('Northstar PureAir 300'), h.docId).toBe(true)
  })

  for (const lang of ['en', 'pl'] as const) {
    it(`returns the superseded calibration procedure flagged, near the bulletin that replaces it (${lang})`, async () => {
      const embed = await ready(lang)
      const query = lang === 'en' ? 'PureAir 300 S2 sensor calibration' : 'PureAir 300 S2 kalibracja czujnika'
      const hits = await searchKnowledge({ query, productModel: 'Northstar PureAir 300', errorCode: 'S2' }, { lang, embed, k: 10 })
      const old = hits.find((h) => h.docId === 'DOC-pureair-sensor-calibration-2025')
      expect(old).toMatchObject({ status: 'superseded', supersededBy: 'DOC-sb-2026-07' })
      const all = hits.map((h) => h.docId)
      expect(all).toContain('DOC-sb-2026-07')
      for (const h of hits.filter((x) => x.docId !== 'DOC-pureair-sensor-calibration-2025')) {
        expect(h.status).toBe('current')
        expect(h).not.toHaveProperty('supersededBy')
      }
    })
  }

  // The nine scenarios run on the mock provider when no API key is set: the
  // document that answers each customer's question must be among the hits.
  const scenarioQueries: [Lang, { query: string; productModel?: string; errorCode?: string }, string][] = [
    ['en', { query: 'Barista Pro 500 shows error E04 and will not brew coffee', productModel: 'Northstar Barista Pro 500', errorCode: 'E04' }, 'DOC-bp500-e04-troubleshooting'],
    ['pl', { query: 'ekspres pokazuje błąd E04 i nie parzy kawy', productModel: 'Northstar Barista Pro 500', errorCode: 'E04' }, 'DOC-bp500-e04-troubleshooting'],
    ['en', { query: 'PureAir 300 shows S2 and the air quality number never changes', productModel: 'Northstar PureAir 300', errorCode: 'S2' }, 'DOC-sb-2026-07'],
    ['pl', { query: 'PureAir 300 pokazuje S2, a wskaźnik jakości powietrza się nie zmienia', productModel: 'Northstar PureAir 300', errorCode: 'S2' }, 'DOC-sb-2026-07'],
    ['en', { query: 'AeroClean V10 battery lasts only a few minutes, is it under warranty', productModel: 'Northstar AeroClean V10' }, 'DOC-vacuum-battery-faults'],
    ['pl', { query: 'akumulator AeroClean V10 wystarcza tylko na kilka minut, czy jest gwarancja', productModel: 'Northstar AeroClean V10' }, 'DOC-vacuum-battery-faults'],
    ['en', { query: 'Barista Compact 200 is leaking again and shows E07, third time', productModel: 'Northstar Barista Compact 200', errorCode: 'E07' }, 'DOC-compact-200-guide'],
    ['pl', { query: 'Barista Compact 200 znowu cieknie i pokazuje E07, trzeci raz', productModel: 'Northstar Barista Compact 200', errorCode: 'E07' }, 'DOC-compact-200-guide'],
    ['en', { query: 'same fault repaired twice, third time, replacement', productModel: 'Northstar Barista Compact 200' }, 'DOC-warranty-terms'],
    ['pl', { query: 'ta sama usterka naprawiana dwa razy, po raz trzeci, wymiana', productModel: 'Northstar Barista Compact 200' }, 'DOC-warranty-terms'],
    ['en', { query: 'AirCrisp 5 air fryer switches itself off after ten minutes and the housing gets very hot', productModel: 'Northstar AirCrisp 5' }, 'DOC-kitchen-overheating'],
    ['pl', { query: 'frytkownica AirCrisp 5 wyłącza się po dziesięciu minutach, obudowa bardzo się nagrzewa', productModel: 'Northstar AirCrisp 5' }, 'DOC-kitchen-overheating'],
    ['en', { query: 'paid repair after the warranty has expired' }, 'DOC-paid-repairs'],
    ['pl', { query: 'odpłatna naprawa po wygaśnięciu gwarancji' }, 'DOC-paid-repairs'],
    ['en', { query: 'complaint: repair overdue, promised date passed, nobody called back', productModel: 'Northstar SteamChef Oven 30' }, 'DOC-complaint-handling'],
    ['pl', { query: 'reklamacja: naprawa opóźniona, minął obiecany termin, nikt nie oddzwonił', productModel: 'Northstar SteamChef Oven 30' }, 'DOC-complaint-handling'],
    ['en', { query: 'replacement part delayed, delivery estimate', productModel: 'Northstar RoboClean R5' }, 'DOC-shipping-delivery'],
    ['pl', { query: 'część zamienna opóźniona, termin dostawy', productModel: 'Northstar RoboClean R5' }, 'DOC-shipping-delivery'],
  ]
  for (const [lang, q, docId] of scenarioQueries) {
    it(`finds ${docId} for "${q.query}" (${lang})`, async () => {
      const hits = await searchKnowledge(q, { lang, embed: await ready(lang) })
      expect(hits.map((h) => h.docId)).toContain(docId)
    })
  }
})
