/**
 * The agent loop, driven by the browser.
 *
 * Each model turn is one `deps.agentStep` call (POST /api/agent). The Worker
 * answers with validated tool calls or a final answer; the engine executes the
 * calls locally, appends one tool message per call in the model's order and
 * asks again, until the model answers, a limit is reached, an error occurs or
 * the user cancels.
 *
 * The engine knows nothing of React, the store, IndexedDB or `fetch`: everything
 * goes through `EngineDeps`. It reports what happens as `TraceEvent`s at the
 * moment it happens; it never records model reasoning.
 */
import type { AgentMessage, AgentResponse, Lang, RejectedToolCall, ToolCall, ValidatedToolCall } from '@shared/api-types'
import { isToolName, getTool, type ToolName } from '@shared/tools'
import { errorSummary } from '@/sim/summaries'
import { toolResultForModel, type ToolErrorCode, type ToolResult } from '@/sim/tools'
import {
  DEFAULT_MAX_STEPS,
  MAX_IDENTICAL_CALLS,
  MODEL_CALL_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
  TOOL_TIMEOUT_MS,
  fitToolContent,
} from './limits'
import type { EngineDeps, RunEndReason, RunInput, RunOutcome, RunResult } from './types'

// ---------------------------------------------------------------- helpers

/** JSON with sorted object keys, so `{a,b}` and `{b,a}` are the same call. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

export function callKey(name: string, args: Record<string, unknown>): string {
  return `${name} ${canonicalJson(args)}`
}

/** Engine-made results; the summary is UI text in the run's language. */
const TIMEOUT_SUMMARY: Record<Lang, string> = { en: 'The tool did not answer in time', pl: 'Narzędzie nie odpowiedziało na czas' }

function errorResult(lang: Lang, code: ToolErrorCode, message: string, summary = errorSummary(lang, code)): ToolResult {
  return { ok: false, error: { code, message }, summary }
}

/** The call certainly did not run. */
function notExecuted(lang: Lang, message = 'The run ended before this call was executed. Nothing was done.'): ToolResult {
  return errorResult(lang, 'not_executed', message)
}

/** The call was started but its result was not recorded (it may have completed). */
function resultUnknown(lang: Lang): ToolResult {
  return errorResult(lang, 'result_unknown', 'The run was stopped while this call was running. Whether it completed is not known; its result was not recorded.')
}

const MAX_RAW_ARGS_IN_MESSAGE = 500

function parseRawArgs(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

class Aborted extends Error {}

/** Resolves with `p`, or rejects with `Aborted` as soon as `signal` aborts (even if `p` never settles). */
function untilAborted<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Aborted())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Aborted())
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

/** A countdown that can be paused (while the user decides on a confirmation). */
function pausableTimer(ms: number, onFire: () => void) {
  let remaining = ms
  let startedAt = 0
  let handle: ReturnType<typeof setTimeout> | null = null
  const resume = () => {
    if (handle !== null || remaining <= 0) return
    startedAt = Date.now()
    handle = setTimeout(() => {
      handle = null
      remaining = 0
      onFire()
    }, remaining)
  }
  const pause = () => {
    if (handle === null) return
    clearTimeout(handle)
    handle = null
    remaining = Math.max(0, remaining - (Date.now() - startedAt))
  }
  return { resume, pause, stop: pause }
}

interface Stop {
  outcome: Exclude<RunOutcome, 'answered'>
  reason: RunEndReason
  detail?: string
  answer?: string
}

// ---------------------------------------------------------------- engine

export async function runAgent(input: RunInput, deps: EngineDeps, signal: AbortSignal): Promise<RunResult> {
  const { lang } = input
  const transcript: AgentMessage[] = [...input.history, { role: 'user', content: input.message }]
  /** Requests of each (name, canonical args) in this run. */
  const requested = new Map<string, number>()
  let seq = 0
  let step = 0
  let maxSteps = DEFAULT_MAX_STEPS

  // `run` aborts on user cancel or on the run timeout; `endReason` says which came first.
  const run = new AbortController()
  let abortReason: 'cancelled' | 'run_timeout' | null = null
  const abortRun = (why: 'cancelled' | 'run_timeout') => {
    abortReason ??= why
    run.abort()
  }
  const onUserAbort = () => abortRun('cancelled')
  signal.addEventListener('abort', onUserAbort)
  if (signal.aborted) onUserAbort()
  const runTimer = pausableTimer(RUN_TIMEOUT_MS, () => abortRun('run_timeout'))
  runTimer.resume()

  const abortStop = (): Stop =>
    abortReason === 'run_timeout' ? { outcome: 'limit', reason: 'run_timeout' } : { outcome: 'cancelled', reason: 'cancelled' }

  /** Answers every call of the last assistant message that has no tool message yet, so the transcript stays sendable. */
  const closeTranscript = () => {
    let i = transcript.length - 1
    while (i >= 0 && transcript[i]!.role === 'tool') i--
    const last = transcript[i]
    if (!last || last.role !== 'assistant' || !last.toolCalls?.length) return
    const answered = new Set(transcript.slice(i + 1).map((m) => (m as { toolCallId: string }).toolCallId))
    for (const c of last.toolCalls) {
      if (!answered.has(c.id)) transcript.push({ role: 'tool', toolCallId: c.id, name: c.name, content: toolResultForModel(notExecuted(lang)) })
    }
  }

  const finish = (outcome: RunOutcome, answer: string, stop?: Stop): RunResult => {
    closeTranscript()
    deps.emit({ type: 'run_finished', at: deps.now(), outcome, ...(stop ? { detail: stop.reason } : {}), answer })
    return { transcript, outcome, answer, ...(stop ? { reason: stop.reason } : {}), ...(stop?.detail ? { detail: stop.detail } : {}) }
  }
  const stopWith = (s: Stop) => finish(s.outcome, s.answer ?? '', s)

  deps.emit({ type: 'run_started', runId: input.runId, at: deps.now(), customerId: input.customer.id, message: input.message, enabledTools: [...input.enabledTools] })

  try {
    for (;;) {
      if (run.signal.aborted) return stopWith(abortStop())
      if (step >= maxSteps) return stopWith({ outcome: 'limit', reason: 'max_steps' })
      step++

      // ---- model turn
      deps.emit({ type: 'model_started', step, at: deps.now() })
      const t0 = deps.now()
      const call = new AbortController()
      let modelTimedOut = false
      const onRunAbort = () => call.abort()
      run.signal.addEventListener('abort', onRunAbort)
      const modelTimer = setTimeout(() => {
        modelTimedOut = true
        call.abort()
      }, MODEL_CALL_TIMEOUT_MS)
      let res: AgentResponse
      try {
        const req = { runId: input.runId, lang, customer: input.customer, enabledTools: [...input.enabledTools], messages: [...transcript] }
        res = await untilAborted(deps.agentStep(req, call.signal), call.signal)
      } catch (e) {
        if (run.signal.aborted) return stopWith(abortStop())
        if (modelTimedOut) return stopWith({ outcome: 'limit', reason: 'model_timeout' })
        const code = (e as { code?: unknown })?.code
        const message = e instanceof Error ? e.message : String(e)
        if (code === 'run_limit_exceeded' || code === 'quota_exceeded') return stopWith({ outcome: 'limit', reason: code, detail: message })
        return stopWith({ outcome: 'error', reason: typeof code === 'string' ? code : 'unexpected', detail: message })
      } finally {
        clearTimeout(modelTimer)
        run.signal.removeEventListener('abort', onRunAbort)
      }
      if (run.signal.aborted) return stopWith(abortStop())

      if (res.limits?.maxSteps) maxSteps = res.limits.maxSteps
      const assistant: Extract<AgentMessage, { role: 'assistant' }> = { role: 'assistant', content: res.assistantMessage.content ?? '' }
      if (res.assistantMessage.toolCalls?.length) assistant.toolCalls = res.assistantMessage.toolCalls
      transcript.push(assistant)
      const at = deps.now()
      deps.emit({
        type: 'model_finished', step, at, durationMs: at - t0, kind: res.kind, text: assistant.content, usage: res.usage, forcedFinal: res.forcedFinal,
      })

      if (res.kind === 'final' || !assistant.toolCalls?.length) {
        const answer = assistant.content.trim()
        if (res.forcedFinal) return stopWith({ outcome: 'limit', reason: 'forced_final', answer })
        if (!answer) return stopWith({ outcome: 'error', reason: 'empty_answer' })
        return finish('answered', answer)
      }

      // ---- tool turn
      const stop = await runToolStep(res, assistant.toolCalls, res.forcedFinal)
      if (stop) return stopWith(stop)
      if (run.signal.aborted) return stopWith(abortStop())
      if (res.forcedFinal) return stopWith({ outcome: 'limit', reason: 'forced_final' })
    }
  } finally {
    runTimer.stop()
    signal.removeEventListener('abort', onUserAbort)
  }

  /**
   * Executes one tool turn and appends its tool messages; returns a `Stop` when the run must end.
   * On a forced-final turn nothing is executed: valid calls are answered as `not_executed`.
   */
  async function runToolStep(res: AgentResponse, calls: ToolCall[], forced: boolean): Promise<Stop | null> {
    const valid = new Map(res.toolCalls.map((c) => [c.id, c]))
    const rejected = new Map(res.rejected.map((r) => [r.id, r]))
    const results = new Map<string, ToolResult>()
    const record = (id: string, startedAt: number, result: ToolResult, durationMs?: number) => {
      finished(id, startedAt, result, durationMs)
      results.set(id, result)
    }

    // Loop detection first: the third identical request ends the run before anything of this turn runs.
    const duplicates = new Set<string>()
    if (!forced) {
      const counts = new Map(requested)
      for (const c of calls) {
        const v = valid.get(c.id)
        if (!v) continue
        const key = callKey(v.name, v.arguments)
        const n = (counts.get(key) ?? 0) + 1
        counts.set(key, n)
        if (n >= MAX_IDENTICAL_CALLS) {
          const startedAt = started(v.id, v.name, v.system, v.readOnly, v.arguments)
          record(v.id, startedAt, errorResult(lang, 'duplicate_call', `Repeated identical call to ${v.name}. The run is stopped.`), 0)
          return { outcome: 'limit', reason: 'tool_loop' }
        }
        if (n > 1) duplicates.add(v.id)
      }
      for (const [k, n] of counts) requested.set(k, n)
    }

    const parallel: { v: ValidatedToolCall; startedAt: number }[] = []
    const confirmations: ValidatedToolCall[] = []
    const immediate: { id: string; startedAt: number; result: ToolResult }[] = []
    for (const c of calls) {
      const v = valid.get(c.id)
      const r = rejected.get(c.id)
      if (v && forced) {
        const startedAt = started(v.id, v.name, v.system, v.readOnly, v.arguments)
        immediate.push({ id: v.id, startedAt, result: notExecuted(lang, 'The run limit is reached and tools are no longer available. This call was not executed.') })
      } else if (v && duplicates.has(v.id)) {
        const startedAt = started(v.id, v.name, v.system, v.readOnly, v.arguments)
        const message = `${v.name} was already called with the same arguments in this run; use the earlier result.`
        immediate.push({ id: v.id, startedAt, result: errorResult(lang, 'duplicate_call', message) })
      } else if (v && (v.requiresConfirmation || !isToolName(v.name) || !getTool(v.name).readOnly)) {
        // Approval also follows the shared tool registry, so a wrong flag in a
        // response can never run a state-changing tool in the parallel batch.
        confirmations.push(v)
      } else if (v) {
        parallel.push({ v, startedAt: started(v.id, v.name, v.system, v.readOnly, v.arguments) })
      } else if (r) {
        immediate.push({ id: r.id, startedAt: startRejected(r), result: rejectedResult(r) })
      }
    }
    // None of these ran.
    for (const x of immediate) record(x.id, x.startedAt, x.result, 0)

    // Read-only calls in parallel; a cancel (or the run timeout) does not wait for them.
    let batchOpen = true
    const batch = Promise.all(
      parallel.map(async ({ v, startedAt }) => {
        const result = await execute(v)
        if (batchOpen) record(v.id, startedAt, result)
      }),
    )
    try {
      await untilAborted(batch, run.signal)
    } catch {
      // aborted: closed below
    }
    batchOpen = false
    for (const { v, startedAt } of parallel) if (!results.has(v.id)) record(v.id, startedAt, resultUnknown(lang), 0)

    for (const v of confirmations) {
      if (run.signal.aborted) break
      const startedAt = started(v.id, v.name, v.system, v.readOnly, v.arguments)
      deps.emit({ type: 'confirmation_requested', callId: v.id, at: deps.now() })
      runTimer.pause()
      let approved = false
      let aborted = false
      try {
        approved = (await untilAborted(deps.confirm(v, run.signal), run.signal)) === true
      } catch (e) {
        aborted = e instanceof Aborted
      } finally {
        runTimer.resume()
      }
      if (aborted || run.signal.aborted) {
        // Cancelled before (or in the same moment as) the decision: never write after a cancel.
        record(v.id, startedAt, notExecuted(lang, 'The run was cancelled before this call was executed. Nothing was done.'), 0)
        break
      }
      deps.emit({ type: 'confirmation_resolved', callId: v.id, approved, at: deps.now() })
      if (!approved) {
        record(v.id, startedAt, errorResult(lang, 'rejected_by_user', 'The customer did not approve this action. It was not executed; nothing was created.'), 0)
        continue
      }
      // The duration is that of the execution only, not of the user's decision.
      const execAt = deps.now()
      record(v.id, execAt, await execute(v))
    }

    // Tool messages in the model's order. A call without a result (not reached because the
    // run was cancelled, or listed by the Worker neither as valid nor as rejected) gets a "not executed" answer.
    for (const c of calls) {
      const r = results.get(c.id)
      if (r) transcript.push({ role: 'tool', toolCallId: c.id, name: c.name, content: fitToolContent(toolResultForModel(r)) })
    }
    closeTranscript()
    return null
  }

  function started(callId: string, name: string, system: ValidatedToolCall['system'] | null, readOnly: boolean, args: Record<string, unknown>): number {
    const at = deps.now()
    deps.emit({ type: 'tool_started', step, callId, seq: ++seq, name, system, readOnly, args, at })
    return at
  }

  function startRejected(r: RejectedToolCall): number {
    const def = isToolName(r.name) ? getTool(r.name as ToolName) : null
    return started(r.id, r.name, def?.system ?? null, def?.readOnly ?? true, parseRawArgs(r.rawArguments))
  }

  /** `durationMs` is given as 0 for calls that never ran. */
  function finished(callId: string, startedAt: number, result: ToolResult, durationMs?: number) {
    const at = deps.now()
    deps.emit({ type: 'tool_finished', callId, at, durationMs: durationMs ?? at - startedAt, result })
  }

  /** The Worker's message, plus the reason and the raw arguments, so the trace shows what the model actually sent. */
  function rejectedResult(r: RejectedToolCall): ToolResult {
    const raw = r.rawArguments.length > MAX_RAW_ARGS_IN_MESSAGE ? `${r.rawArguments.slice(0, MAX_RAW_ARGS_IN_MESSAGE)}…` : r.rawArguments
    return errorResult(lang, r.reason, `${r.message} (reason: ${r.reason}; arguments sent: ${raw === '' ? '(none)' : raw})`)
  }

  /** Runs one validated call with the tool timeout; exceptions become `failed` results. */
  async function execute(v: ValidatedToolCall): Promise<ToolResult> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<ToolResult>((resolve) => {
      timer = setTimeout(
        () => resolve(errorResult(lang, 'failed', `${v.name} did not answer within ${TOOL_TIMEOUT_MS / 1000} seconds.`, TIMEOUT_SUMMARY[lang])),
        TOOL_TIMEOUT_MS,
      )
    })
    try {
      return await Promise.race([
        deps.executeTool(v.name, v.arguments, deps.toolContext).catch(() =>
          errorResult(lang, 'failed', 'The company system did not respond. The tool could not complete; try again later or offer human support.'),
        ),
        timeout,
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}
