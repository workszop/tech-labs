import { describe, expect, it } from 'vitest'
import { CHECKS, type GuideQuestions } from './guideChecks'
import { getState, type AppState, type QueryRun } from './store'

const Q: GuideQuestions = { guiding: 'G?', refund: 'R?', phone: 'P?', batch: 'B?' }
let t = 0
function run(question: string, docIds: string[], o: { topK?: number; chunkSize?: number; labels?: string } = {}): QueryRun {
  t += 1
  return {
    id: `r${t}`,
    question,
    createdAt: t,
    index: { docIds, docTitles: [], chunkSize: o.chunkSize ?? 400, overlap: 60, labels: o.labels ?? 'none', chunks: 5 },
    topK: o.topK ?? 3,
    threshold: null,
    ragEnabled: true,
    compare: false,
    embed: { status: 'completed' },
    search: { status: 'completed' },
    context: { status: 'completed', included: [], belowThreshold: 0 },
    generate: { status: 'completed', mode: 'rag', answer: 'x' },
  }
}
const state = (...runs: QueryRun[]): AppState => ({ ...getState(), runs: Object.fromEntries(runs.map((r) => [r.id, r])) })
const C = ['proces-04', 'proces-04-v6', 'rejestr-reklamacji', 'wysylka-wz-0318']
const noDraft = C.filter((d) => d !== 'proces-04-v6')

describe('guide checks', () => {
  it('sources: a question with the draft in the base', () => {
    expect(CHECKS.sources(state(run('G?', C)), Q)).toBe(true)
    expect(CHECKS.sources(state(run('G?', noDraft)), Q)).toBe(false)
  })

  it('refund: the refund question at top-k 1 with the draft', () => {
    expect(CHECKS.refund(state(run('R?', C, { topK: 1 })), Q)).toBe(true)
    expect(CHECKS.refund(state(run('R?', C, { topK: 3 })), Q)).toBe(false)
    expect(CHECKS.refund(state(run('R?', noDraft, { topK: 1 })), Q)).toBe(false)
  })

  it('outdated: both questions again without the draft, after a run with it', () => {
    expect(CHECKS.outdated(state(run('G?', C), run('G?', noDraft), run('R?', noDraft)), Q)).toBe(true)
    expect(CHECKS.outdated(state(run('G?', C), run('G?', noDraft)), Q)).toBe(false)
    expect(CHECKS.outdated(state(run('G?', noDraft), run('R?', noDraft), run('G?', C)), Q)).toBe(false)
  })

  it('personal: the phone question with the register, then without it', () => {
    expect(CHECKS.personal(state(run('P?', C), run('P?', ['proces-04'])), Q)).toBe(true)
    expect(CHECKS.personal(state(run('P?', ['proces-04']), run('P?', C)), Q)).toBe(false)
  })

  it('chunkTopk: small chunks at top-k 1 and at top-k 3 or more', () => {
    expect(CHECKS.chunkTopk(state(run('G?', noDraft, { chunkSize: 100, topK: 1 }), run('G?', noDraft, { chunkSize: 100, topK: 3 })), Q)).toBe(true)
    expect(CHECKS.chunkTopk(state(run('G?', noDraft, { chunkSize: 100, topK: 1 }), run('G?', noDraft, { chunkSize: 400, topK: 3 })), Q)).toBe(false)
  })

  it('diagnose: the batch question with the batch procedure in the base', () => {
    expect(CHECKS.diagnose(state(run('B?', [...noDraft, 'proces-06'])), Q)).toBe(true)
    expect(CHECKS.diagnose(state(run('B?', noDraft)), Q)).toBe(false)
  })

  it('fixes: all three fixes tried on the batch question', () => {
    const q = [...noDraft, 'proces-06']
    const all = [run('B?', q, { labels: 'section' }), run('B?', q, { topK: 5 }), run('B?', q, { chunkSize: 200 })]
    expect(CHECKS.fixes(state(...all), Q)).toBe(true)
    expect(CHECKS.fixes(state(all[0], all[1]), Q)).toBe(false)
    expect(CHECKS.fixes(state(run('B?', q, { labels: 'section+meta' }), all[1], all[2]), Q)).toBe(true)
  })
})
