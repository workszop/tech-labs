/** The custom-case editor's form as text fields, and the checks before it is saved. */
import type { BenchmarkCase, CaseKind } from '@/rag/benchmark'

export interface CaseDraft {
  id?: string
  kind: CaseKind
  question: string
  expectedDocIds: string[]
  expectedAnswer: string
  /** One group per line, accepted spellings separated by `|`. */
  keyFacts: string
  /** One string per line. */
  mustNotContain: string
}

export const emptyDraft = (): CaseDraft => ({ kind: 'ordinary', question: '', expectedDocIds: [], expectedAnswer: '', keyFacts: '', mustNotContain: '' })

export function parseLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

export function parseKeyFacts(text: string): string[][] {
  return text
    .split('\n')
    .map((l) => l.split('|').map((x) => x.trim()).filter(Boolean))
    .filter((g) => g.length > 0)
}

export function formatKeyFacts(facts: string[][]): string {
  return facts.map((g) => g.join(' | ')).join('\n')
}

export function draftFromCase(c: BenchmarkCase): CaseDraft {
  return { id: c.id, kind: c.kind, question: c.question, expectedDocIds: [...c.expectedDocIds], expectedAnswer: c.expectedAnswer, keyFacts: formatKeyFacts(c.keyFacts), mustNotContain: c.mustNotContain.join('\n') }
}

export function draftToCase(d: CaseDraft): Omit<BenchmarkCase, 'builtIn' | 'lang' | 'id'> & { id?: string } {
  return {
    id: d.id,
    kind: d.kind,
    question: d.question.trim(),
    expectedDocIds: d.expectedDocIds,
    expectedAnswer: d.expectedAnswer.trim(),
    keyFacts: parseKeyFacts(d.keyFacts),
    mustNotContain: parseLines(d.mustNotContain),
  }
}

/** Kinds whose answer comes from the documents, so the documents that must reach the model are known. */
const NEEDS_DOCS: CaseKind[] = ['ordinary', 'exception']

export function validateDraft(d: CaseDraft): { errors: ('question' | 'docs')[]; studentVerdict: boolean } {
  const errors: ('question' | 'docs')[] = []
  if (!d.question.trim()) errors.push('question')
  if (NEEDS_DOCS.includes(d.kind) && d.expectedDocIds.length === 0) errors.push('docs')
  const studentVerdict = parseKeyFacts(d.keyFacts).length === 0 && parseLines(d.mustNotContain).length === 0
  return { errors, studentVerdict }
}
