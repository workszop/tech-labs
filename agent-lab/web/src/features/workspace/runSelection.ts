/** Pure part of the run selection of the centre panel (see `useRunView`). */
import type { RunRecord } from '@/agent/types'

/**
 * Runs listed in the selector: the runs of the current conversation, the run in
 * progress and a run whose step was selected elsewhere (the chat). A run shown
 * earlier is not kept: after "New conversation" the list starts empty.
 */
export function listRuns(p: { allRuns: readonly RunRecord[]; conversationRunIds: readonly string[]; currentRun: string | null; selectedRunId: string | null }): RunRecord[] {
  const ids = new Set(p.conversationRunIds)
  return p.allRuns.filter((r) => ids.has(r.id) || r.id === p.currentRun || r.id === p.selectedRunId)
}

/** The run shown: the picked one if it is listed, else the run in progress, else the newest listed run. */
export function pickShownRun(runs: readonly RunRecord[], picked: string | null, currentRun: string | null): RunRecord | null {
  return runs.find((r) => r.id === picked) ?? runs.find((r) => r.id === currentRun) ?? runs.at(-1) ?? null
}
