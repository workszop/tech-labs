import { describe, expect, it } from 'vitest'
import { buildRunsCsv, type RunsCsvWords } from './benchLog'
import { csvField } from './testLog'
import type { BenchmarkRun } from './store'
import type { BenchmarkCase, CaseResult } from '@/rag/benchmark'

const W: RunsCsvWords = {
  time: 'Czas', run: 'Przebieg', documents: 'Dokumenty', chunkSize: 'Rozmiar', overlap: 'Nakładanie', labels: 'Etykieta', topK: 'Top-k', threshold: 'Próg',
  kind: 'Rodzaj', question: 'Pytanie', expected: 'Oczekiwane dokumenty', retrieval: 'Wyszukiwanie', answerCheck: 'Sprawdzenie odpowiedzi', verdict: 'Wynik',
  overridden: 'Zmieniony ręcznie', answer: 'Odpowiedź', yes: 'tak', no: 'nie', pass: 'przeszło', fail: 'nie przeszło', manual: 'ocena ręczna',
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
  caseInfo: {
    c1: { kind: 'ordinary', question: 'Do jakiej kwoty; sama?', expectedDocTitles: ['PROCES-04 Obsługa reklamacji'] },
    c2: { kind: 'restricted', question: 'Telefon klienta?', expectedDocTitles: [] },
  },
}

describe('buildRunsCsv', () => {
  const csv = buildRunsCsv([run], [c1, c2], W, (k) => (k === 'section' ? 'sekcja' : k), 'pl-PL')
  const lines = csv.slice(1).trim().split('\r\n')
  it('starts with the BOM and has a header and one row per result', () => {
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(lines).toHaveLength(3)
    expect(lines[0].split(';')).toHaveLength(16)
  })
  it('writes the settings, the scores and the verdict', () => {
    expect(lines[1]).toContain(';1;PROCES-04 | PROCES-06;400;60;sekcja;3;0.30;zwykłe;"Do jakiej kwoty; sama?";PROCES-04 Obsługa reklamacji;1.00;przeszło;przeszło;nie;')
    expect(lines[2]).toContain(';zastrzeżone;Telefon klienta?;;;przeszło;nie przeszło;tak;Nie podam.')
  })
  it('formats the run time in the language of the export', () => {
    const at = new Date(run.createdAt)
    expect(lines[1].startsWith(csvField(at.toLocaleString('pl-PL')) + ';')).toBe(true)
    const en = buildRunsCsv([run], [c1, c2], W, (k) => k, 'en-US').slice(1).trim().split('\r\n')
    expect(en[1].startsWith(csvField(at.toLocaleString('en-US')) + ';')).toBe(true)
    expect(at.toLocaleString('pl-PL')).not.toBe(at.toLocaleString('en-US'))
  })
  it('writes "manual" in words when nothing could be checked automatically', () => {
    const manual: CaseResult = { ...ok, answer: { facts: [], forbidden: [], pass: null }, override: 'pass' }
    const rows = buildRunsCsv([{ ...run, results: [manual] }], [c1], W, (k) => k, 'pl-PL').slice(1).trim().split('\r\n')
    expect(rows[1]).toContain(';1.00;ocena ręczna;przeszło;tak;')
  })
  it('stays readable when a case was deleted after the run', () => {
    const rows = buildRunsCsv([run], [], W, (k) => k, 'pl-PL').slice(1).trim().split('\r\n')
    expect(rows[1]).toContain(';zwykłe;"Do jakiej kwoty; sama?";PROCES-04 Obsługa reklamacji;')
  })
  it('falls back to the current cases for a run stored without the snapshot', () => {
    const old = { ...run, caseInfo: undefined }
    const rows = buildRunsCsv([old], [c1, c2], W, (k) => k, 'pl-PL').slice(1).trim().split('\r\n')
    expect(rows[1]).toContain(';zwykłe;"Do jakiej kwoty; sama?";proces-04;')
  })
})
