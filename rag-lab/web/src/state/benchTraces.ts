/**
 * Every benchmark question leaves a query run (with its query vector) in `state.runs`. Only the traces of
 * the latest benchmark runs are kept; chat runs are never touched.
 */
import type { AppState, QueryRun } from './store'

export const KEPT_TRACE_RUNS = 2

/**
 * `state.runs` without the benchmark traces of older benchmark runs. A query run is a benchmark trace when
 * the chat does not show it and it is not the active run. `live` names traces a running benchmark has made
 * but not yet recorded in its results. Returns the same object when nothing is dropped.
 */
export function pruneBenchTraces(
  s: Pick<AppState, 'runs' | 'chat' | 'activeRunId'> & { bench: Pick<AppState['bench'], 'runs'> },
  live: string[] = [],
  keep = KEPT_TRACE_RUNS,
): Record<string, QueryRun> {
  const kept = new Set<string>(live)
  for (const e of s.chat) kept.add(e.runId)
  if (s.activeRunId) kept.add(s.activeRunId)
  for (const b of s.bench.runs.slice(-keep)) for (const r of b.results) if (r.queryRunId) kept.add(r.queryRunId)
  const ids = Object.keys(s.runs)
  if (ids.every((id) => kept.has(id))) return s.runs
  return Object.fromEntries(ids.filter((id) => kept.has(id)).map((id) => [id, s.runs[id]]))
}
