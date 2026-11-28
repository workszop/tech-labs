// When does a workshop step count as done? Each check looks for the answers that show the step's
// effect (for example the same question at top-k 1 and at top-k 3), not for a button press.
import type { AppState, QueryRun } from './store'

export const DRAFT = 'proces-04-v6' // the unapproved draft that competes with the procedure in force
export const CURRENT = 'proces-04'
export const REGISTER = 'rejestr-reklamacji'
export const BATCH_DOC = 'proces-06'

export interface GuideQuestions {
  guiding: string
  refund: string
  phone: string
  batch: string
}

type Check = (s: AppState, q: GuideQuestions) => boolean

export const ragRuns = (s: AppState): QueryRun[] =>
  Object.values(s.runs)
    .filter((r) => r.ragEnabled && r.generate.status === 'completed' && !!r.index)
    .sort((a, b) => a.createdAt - b.createdAt)

const has = (r: QueryRun, doc: string) => r.index!.docIds.includes(doc)
const asked = (s: AppState, question: string) => ragRuns(s).filter((r) => r.question === question)

export const CHECKS: Record<'sources' | 'refund' | 'outdated' | 'personal' | 'chunkTopk' | 'diagnose' | 'fixes', Check> = {
  sources: (s) => ragRuns(s).some((r) => has(r, DRAFT)),
  refund: (s, q) => asked(s, q.refund).some((r) => r.topK === 1 && has(r, DRAFT)),
  outdated: (s, q) => {
    const first = ragRuns(s).find((r) => has(r, DRAFT))
    if (!first) return false
    const later = (question: string) => asked(s, question).some((r) => r.createdAt > first.createdAt && !has(r, DRAFT) && has(r, CURRENT))
    return later(q.guiding) && later(q.refund)
  },
  personal: (s, q) => {
    const runs = asked(s, q.phone)
    const withReg = runs.find((r) => has(r, REGISTER))
    return !!withReg && runs.some((r) => r.createdAt > withReg.createdAt && !has(r, REGISTER))
  },
  chunkTopk: (s, q) => {
    const small = asked(s, q.guiding).filter((r) => (r.index!.chunkSize ?? 400) <= 150)
    return small.some((a) => a.topK === 1 && small.some((b) => b.topK >= 3 && b.index!.chunkSize === a.index!.chunkSize))
  },
  diagnose: (s, q) => asked(s, q.batch).some((r) => has(r, BATCH_DOC)),
  fixes: (s, q) => {
    const runs = asked(s, q.batch).filter((r) => has(r, BATCH_DOC))
    return (
      runs.some((r) => r.index!.labels.includes('section')) &&
      runs.some((r) => r.topK >= 5) &&
      runs.some((r) => (r.index!.chunkSize ?? 400) <= 250)
    )
  },
}
