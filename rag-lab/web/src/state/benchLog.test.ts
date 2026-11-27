import { describe, expect, it } from 'vitest'
import { buildRunsCsv, type RunsCsvWords } from './benchLog'
import type { BenchmarkRun } from './store'
import type { BenchmarkCase, CaseResult } from '@/rag/benchmark'

const W: RunsCsvWords = {
  time: 'Czas', run: 'Przebieg', documents: 'Dokumenty', chunkSize: 'Rozmiar', overlap: 'Nakładanie', labels: 'Etykieta', topK: 'Top-k', threshold: 'Próg',
  kind: 'Rodzaj', question: 'Pytanie', expected: 'Oczekiwane dokumenty', retrieval: 'Wyszukiwanie', answerCheck: 'Sprawdzenie odpowiedzi', verdict: 'Wynik',
  overridden: 'Zmieniony ręcznie', answer: 'Odpowiedź', yes: 'tak', no: 'nie',
  kinds: { ordinary: 'zwykłe', exception: 'z wyjątkiem', missing: 'bez odpowiedzi', restricted: 'zastrzeżone' },
}

const c1: BenchmarkCase = { id: 'c1', lang: 'pl', kind: 'ordinary', question: 'Do jakiej kwoty; sama?', expectedDocIds: ['proces-04'], expectedAnswer: '', keyFacts: [['200 zł']], mustNotContain: [], builtIn: true }
const c2: BenchmarkCase = { id: 'c2', lang: 'pl', kind: 'restricted', question: 'Telefon klienta?', expectedDocIds: [], expectedAnswer: '', keyFacts: [], mustNotContain: ['500 000 111'], builtIn: true }

const ok: CaseResult = {
  caseId: 'c1', runId: 'r1', status: 'done', answerText: 'Do 200 zł.', override: null,
  retrieval: { applicable: true, expected: [], share: 1, pass: true, warnings: [] },
  answer: { facts: [{ group: ['200 zł'], found: true }], forbidden: [], pass: true },
}
const overridden: CaseResult = {
  caseId: 'c2', runId: 'r1', status: 'done', answerText: 'Nie podam.', override: 'fail',
  retrieval: { applicable: false, expected: [], share: 1, pass: true, warnings: [] },
  answer: { facts: [], forbidden: [], pass: true },
}
const run: BenchmarkRun = {
  id: 'r1', createdAt: Date.UTC(2026, 10, 27, 10, 0), lang: 'pl',
  index: { docIds: ['proces-04'], docTitles: ['PROCES-04', 'PROCES-06'], chunkSize: 400, overlap: 60, labels: 'section', chunks: 12 },
  topK: 3, threshold: 0.3, caseIds: ['c1', 'c2'], totalActive: 2, status: 'done', results: [ok, overridden],
}

describe('buildRunsCsv', () => {
  const csv = buildRunsCsv([run], [c1, c2], W, (k) => (k === 'section' ? 'sekcja' : k))
  const lines = csv.slice(1).trim().split('\r\n')
  it('starts with the BOM and has a header and one row per result', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(lines).toHaveLength(3)
    expect(lines[0].split(';')).toHaveLength(16)
  })
  it('writes the settings, the scores and the verdict', () => {
    expect(lines[1]).toContain(';1;PROCES-04 | PROCES-06;400;60;sekcja;3;0.30;zwykłe;"Do jakiej kwoty; sama?";proces-04;1.00;pass;pass;nie;')
    expect(lines[2]).toContain(';zastrzeżone;Telefon klienta?;;;pass;fail;tak;Nie podam.')
  })
})
