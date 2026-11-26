/**
 * Test log: every question of the conversation with the settings it was asked
 * with, the chunks that went to the model and the answer. Participants keep it
 * as evidence when they compare two settings ("change one thing, ask again").
 */
import type { ChunkRecord } from '@/rag/db'
import type { QueryRun } from './store'

export interface TestLogWords {
  time: string
  question: string
  rag: string
  documents: string
  chunkSize: string
  overlap: string
  labels: string
  topK: string
  threshold: string
  context: string
  answer: string
  yes: string
  no: string
}

/** One CSV field, quoted when needed (RFC 4180). */
export function csvField(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build the CSV. `chunkNo` turns a chunk record into its human label ("fragment 20"),
 * `labelName` turns a label key into words. The separator is a semicolon, which
 * Excel opens correctly in Polish and English locales; a BOM keeps Polish letters.
 */
export function buildTestLogCsv(
  runs: QueryRun[],
  chunks: ChunkRecord[],
  w: TestLogWords,
  chunkNo: (c: { chunkIndex: number }) => string,
  labelName: (key: string) => string,
): string {
  const byId = new Map(chunks.map((c) => [c.id, c]))
  const header = [w.time, w.question, w.rag, w.documents, w.chunkSize, w.overlap, w.labels, w.topK, w.threshold, w.context, w.answer]
  const rows = runs.map((r) => {
    const scores = new Map((r.search.ranked ?? []).map((x) => [x.chunkId, x.score]))
    const context = r.context.included
      .map((id, i) => {
        const c: { docTitle: string; chunkIndex: number } | undefined = byId.get(id) ?? r.context.docs?.[i]
        const name = c ? `${c.docTitle}, ${chunkNo(c)}` : id
        const sc = scores.get(id)
        return `[${i + 1}] ${name}${sc != null ? ` (${sc.toFixed(3)})` : ''}`
      })
      .join(' | ')
    return [
      new Date(r.createdAt).toLocaleString(),
      r.question,
      r.ragEnabled ? w.yes : w.no,
      r.index ? r.index.docTitles.join(' | ') : '',
      r.index?.chunkSize ?? '',
      r.index?.overlap ?? '',
      r.index ? labelName(r.index.labels) : '',
      r.topK,
      r.threshold == null ? '' : r.threshold.toFixed(2),
      context,
      r.generate.answer || r.generate.error || '',
    ]
  })
  return '﻿' + [header, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n') + '\r\n'
}
