import { describe, expect, it } from 'vitest'
import { buildTestLogCsv, csvField } from './testLog'
import type { QueryRun } from './store'
import type { ChunkRecord } from '@/rag/db'

const W = { time: 'Czas', question: 'Pytanie', rag: 'RAG', documents: 'Dokumenty', chunkSize: 'Rozmiar', overlap: 'Nakładanie', labels: 'Etykieta', topK: 'Top-k', threshold: 'Próg', context: 'Kontekst', answer: 'Odpowiedź', yes: 'tak', no: 'nie' }

const chunk = { id: 'hr-remote-work#19', docId: 'hr-remote-work', docTitle: 'Zasady pracy zdalnej', chunkIndex: 19 } as ChunkRecord

const run: QueryRun = {
  id: 'r1',
  question: 'Ile wynosi dodatek na biuro domowe?',
  createdAt: Date.UTC(2026, 10, 26, 10, 0),
  index: { docIds: ['hr-remote-work', 'hr-leave-policy'], docTitles: ['Zasady pracy zdalnej', 'Zasady urlopowe'], chunkSize: 120, overlap: 60, labels: 'section', chunks: 80 },
  topK: 3,
  threshold: null,
  ragEnabled: true,
  compare: false,
  embed: { status: 'completed' },
  search: { status: 'completed', ranked: [{ chunkId: 'hr-remote-work#19', score: 0.4591, rank: 1 }] },
  context: { status: 'completed', included: ['hr-remote-work#19'], belowThreshold: 0 },
  generate: { status: 'completed', mode: 'rag', answer: 'Dodatek wynosi 750 USD; „cytat” [1].' },
}

describe('csvField', () => {
  it('quotes separators, quotes and newlines', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a;b')).toBe('"a;b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField(null)).toBe('')
  })
})

describe('buildTestLogCsv', () => {
  it('writes one row per question with settings, context and answer', () => {
    const csv = buildTestLogCsv([run], [chunk], W, (c) => `fragment ${c.chunkIndex + 1}`, (k) => (k === 'section' ? 'sekcja' : k))
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Czas;Pytanie;RAG;Dokumenty;Rozmiar;Nakładanie;Etykieta;Top-k;Próg;Kontekst;Odpowiedź')
    expect(lines[1]).toContain(';Ile wynosi dodatek na biuro domowe?;tak;Zasady pracy zdalnej | Zasady urlopowe;120;60;sekcja;3;;')
    expect(lines[1]).toContain('[1] Zasady pracy zdalnej, fragment 20 (0.459)')
    expect(lines[1]).toContain('"Dodatek wynosi 750 USD; „cytat” [1]."')
  })
  it('keeps the source title when the chunk is no longer in the index', () => {
    const gone = { ...run, id: 'r2', context: { ...run.context, included: ['hr-remote-work-2022#3'], docs: [{ docId: 'hr-remote-work-2022', docTitle: 'Zasady pracy zdalnej (2022, nieaktualne)', chunkIndex: 3 }] } }
    const csv = buildTestLogCsv([gone], [], W, (c) => `fragment ${c.chunkIndex + 1}`, (k) => k)
    expect(csv).toContain('[1] Zasady pracy zdalnej (2022, nieaktualne), fragment 4')
  })
})
