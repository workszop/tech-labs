import { describe, expect, it } from 'vitest'
import type { RunRecord } from '@/agent/types'
import { listRuns, pickShownRun } from './runSelection'

const run = (id: string): RunRecord => ({ id, scenarioId: null, customerId: 'C', message: id, enabledTools: [], startedAt: 0, events: [], model: 'm', lang: 'pl' })
const all = [run('a'), run('b'), run('c')]

describe('run selection', () => {
  it('lists the runs of the conversation and the run in progress', () => {
    expect(listRuns({ allRuns: all, conversationRunIds: ['a', 'b'], currentRun: null, selectedRunId: null }).map((r) => r.id)).toEqual(['a', 'b'])
    expect(listRuns({ allRuns: all, conversationRunIds: ['a'], currentRun: 'c', selectedRunId: null }).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('after a new conversation a previously picked run is neither listed nor shown', () => {
    const runs = listRuns({ allRuns: all, conversationRunIds: [], currentRun: null, selectedRunId: null })
    expect(runs).toEqual([])
    expect(pickShownRun(runs, 'b', null)).toBeNull()
  })

  it('shows the picked run, else the run in progress, else the newest', () => {
    const runs = listRuns({ allRuns: all, conversationRunIds: ['a', 'b'], currentRun: null, selectedRunId: null })
    expect(pickShownRun(runs, 'a', null)?.id).toBe('a')
    expect(pickShownRun(runs, null, null)?.id).toBe('b')
    expect(pickShownRun(runs, 'zzz', null)?.id).toBe('b')
  })

  it('a run selected elsewhere (the chat) is listed', () => {
    expect(listRuns({ allRuns: all, conversationRunIds: ['a'], currentRun: null, selectedRunId: 'c' }).map((r) => r.id)).toEqual(['a', 'c'])
  })
})
