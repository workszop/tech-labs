/**
 * Side-by-side comparison of two recorded runs. Everything comes from the runs'
 * events through `deriveTrace` (the same derivation as the workspace): the tool
 * calls in order, which calls only one run made (matched by tool name and
 * canonical arguments), which tools were switched off, totals, and the final
 * answer. Nothing is rated or scored.
 */
import { getTool, isToolName, type SystemId, type ToolName } from '@shared/tools'
import { callKey } from '@/agent/engine'
import type { RunOutcome, RunRecord } from '@/agent/types'
import { deriveTrace, type CallStatus, type CallView } from '@/features/workspace/trace'
import { disabledTools } from './presets'

export interface CompareCall {
  callId: string
  seq: number
  name: string
  system: SystemId | null
  status: CallStatus
  /** One-line result summary as recorded, or null when the call has no result. */
  summary: string | null
  /** The other run made no call with the same tool name and arguments. */
  only: boolean
}

export interface CompareSide {
  run: RunRecord
  enabled: ToolName[]
  disabled: ToolName[]
  calls: CompareCall[]
  totals: { steps: number; toolCalls: number; durationMs: number | null; tokens: number }
  outcome: RunOutcome | null
  /** Reason code of a run that ended without a normal answer (`run_finished.detail`). */
  endReason: string | null
  answer: string
}

/** A neutral fact about a tool that was off in one run. */
export interface OffNote {
  /** The run in which the tool was off. */
  side: 'a' | 'b'
  tool: ToolName
  system: SystemId
  /** How many calls of this tool the other run made. */
  otherCalls: number
}

export interface Comparison {
  a: CompareSide
  b: CompareSide
  onlyA: number
  onlyB: number
  notes: OffNote[]
}

function side(run: RunRecord, otherKeys: Map<string, number>): { side: CompareSide; keys: string[] } {
  const trace = deriveTrace(run.events, run.enabledTools)
  const remaining = new Map(otherKeys)
  const keys: string[] = []
  const calls = trace.calls.map((c: CallView): CompareCall => {
    const key = callKey(c.name, c.args)
    keys.push(key)
    const left = remaining.get(key) ?? 0
    if (left > 0) remaining.set(key, left - 1)
    return { callId: c.callId, seq: c.seq, name: c.name, system: c.system, status: c.status, summary: c.result?.summary ?? null, only: left === 0 }
  })
  const start = run.events.find((e) => e.type === 'run_started')
  const end = run.events.find((e) => e.type === 'run_finished')
  return {
    keys,
    side: {
      run,
      enabled: [...trace.enabledTools],
      disabled: disabledTools(trace.enabledTools),
      calls,
      totals: {
        steps: trace.turns.length,
        toolCalls: trace.calls.length,
        durationMs: start && end ? Math.max(0, end.at - start.at) : null,
        tokens: trace.totalTokens,
      },
      outcome: run.outcome ?? (end?.type === 'run_finished' ? end.outcome : null),
      endReason: end?.type === 'run_finished' ? (end.detail ?? null) : null,
      answer: run.answer ?? (end?.type === 'run_finished' ? end.answer : ''),
    },
  }
}

function countKeys(run: RunRecord): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of deriveTrace(run.events, run.enabledTools).calls) {
    const k = callKey(c.name, c.args)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function compareRuns(a: RunRecord, b: RunRecord): Comparison {
  const sa = side(a, countKeys(b)).side
  const sb = side(b, countKeys(a)).side
  const notes: OffNote[] = []
  for (const [s, mine, other] of [['a', sa, sb], ['b', sb, sa]] as const) {
    for (const tool of mine.disabled) {
      if (!other.enabled.includes(tool) || !isToolName(tool)) continue
      notes.push({ side: s, tool, system: getTool(tool).system, otherCalls: other.calls.filter((c) => c.name === tool).length })
    }
  }
  return { a: sa, b: sb, onlyA: sa.calls.filter((c) => c.only).length, onlyB: sb.calls.filter((c) => c.only).length, notes }
}

/** The run to compare a run with by default: the run it repeats, else the run before it. */
export function defaultPartner(runs: readonly RunRecord[], run: RunRecord): RunRecord | null {
  if (run.repeatOf) {
    const src = runs.find((r) => r.id === run.repeatOf)
    if (src) return src
  }
  const i = runs.findIndex((r) => r.id === run.id)
  return i > 0 ? runs[i - 1]! : (runs.find((r) => r.id !== run.id) ?? null)
}
