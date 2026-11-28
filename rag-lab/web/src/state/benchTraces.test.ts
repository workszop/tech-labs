import { describe, expect, it } from 'vitest'
import type { CaseResult } from '@/rag/benchmark'
import type { BenchmarkRun, QueryRun } from './store'
import { pruneBenchTraces } from './benchTraces'

const q = (id: string) => ({ id }) as unknown as QueryRun
const res = (queryRunId?: string): CaseResult => ({ caseId: 'c', runId: 'b', status: 'done', retrieval: null, answer: null, answerText: '', override: null, queryRunId })
const bench = (id: string, traces: string[]) => ({ id, results: traces.map(res) }) as unknown as BenchmarkRun

describe('benchmark traces', () => {
  it('keeps the traces of the latest two benchmark runs and every chat run', () => {
    const runs = { a: q('a'), b: q('b'), c: q('c'), chat1: q('chat1') }
    const out = pruneBenchTraces({ runs, chat: [{ id: 'm1', role: 'user', runId: 'chat1' }], activeRunId: null, bench: { runs: [bench('b1', ['a']), bench('b2', ['b']), bench('b3', ['c'])] } })
    expect(Object.keys(out).sort()).toEqual(['b', 'c', 'chat1'])
  })
  it('drops traces of benchmark runs removed from memory', () => {
    const runs = { a: q('a'), b: q('b') }
    const out = pruneBenchTraces({ runs, chat: [], activeRunId: null, bench: { runs: [bench('b2', ['b'])] } })
    expect(Object.keys(out)).toEqual(['b'])
  })
  it('never drops the active run or a chat run, even with no benchmark run', () => {
    const runs = { x: q('x'), y: q('y') }
    const out = pruneBenchTraces({ runs, chat: [{ id: 'm', role: 'assistant', runId: 'x' }], activeRunId: 'y', bench: { runs: [] } })
    expect(out).toBe(runs)
  })
  it('keeps the trace a running benchmark is still producing (not yet in its results)', () => {
    const runs = { a: q('a'), live: q('live') }
    const out = pruneBenchTraces({ runs, chat: [], activeRunId: null, bench: { runs: [bench('b1', ['a'])] } }, ['live'])
    expect(Object.keys(out).sort()).toEqual(['a', 'live'])
  })
  it('returns the same object when nothing is dropped', () => {
    const runs = { a: q('a') }
    expect(pruneBenchTraces({ runs, chat: [], activeRunId: null, bench: { runs: [bench('b1', ['a'])] } })).toBe(runs)
  })
})
