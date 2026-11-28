/**
 * Benchmark: the cases (built-in and the user's own), the run loop and the export. A run asks every
 * planned case through the real query pipeline (outside the chat), scores it and saves the run after
 * every case, so a reload keeps what was finished.
 */
import { ApiError } from '@/api/client'
import { BUILT_IN_CASES } from '@/data/benchmark'
import { getCorpus } from '@/data/corpus'
import { docFlag } from '@/data/docFlag'
import { t } from '@/i18n'
import { uid } from '@/lib/utils'
import { scoreAnswer, scoreRetrieval, type BenchmarkCase, type CaseKind, type CaseResult } from '@/rag/benchmark'
import { abortBenchmark, benchmarkSignal, currentBuildPlan, indexSnapshot, runQuery, vectorStore } from './actions'
import { buildRunsCsv } from './benchLog'
import { pruneBenchTraces } from './benchTraces'
import { isStale } from './membership'
import { closeBenchRun, getState, setSettings, setState, setUi, type AppState, type BenchmarkRun, type QueryRun } from './store'

/** Built-in cases of the current language, then the user's own cases of that language. */
export function allCases(s: AppState = getState()): BenchmarkCase[] {
  const lang = s.settings.lang
  return [...BUILT_IN_CASES[lang], ...s.bench.customCases.filter((c) => c.lang === lang)]
}

export function activeCases(s: AppState = getState()): BenchmarkCase[] {
  const off = new Set(s.settings.benchOff)
  return allCases(s).filter((c) => !off.has(c.id))
}

export interface RunFilter {
  kind?: CaseKind
  ids?: string[]
}

/** Active cases narrowed by the filter, in case order. */
export function plannedCases(filter: RunFilter = {}, s: AppState = getState()): BenchmarkCase[] {
  const ids = filter.ids ? new Set(filter.ids) : null
  return activeCases(s).filter((c) => (!filter.kind || c.kind === filter.kind) && (!ids || ids.has(c.id)))
}

/** Requests a run of `n` cases costs: one query embedding and one chat answer per case. */
export function runCost(n: number): { requests: number } {
  return { requests: 2 * n }
}

export function canRun(
  filter: RunFilter = {},
  s: AppState = getState(),
): { ok: boolean; reason?: 'no-code' | 'empty-kb' | 'stale-kb' | 'no-cases' | 'quota' | 'running'; requests: number; left: number | null } {
  const { requests } = runCost(plannedCases(filter, s).length)
  const left = s.usage ? Math.max(0, s.usage.requestLimit - s.usage.requestsUsed) : null
  const no = (reason: NonNullable<ReturnType<typeof canRun>['reason']>) => ({ ok: false, reason, requests, left })
  if (s.bench.currentRunId) return no('running')
  if (!s.auth.session?.capabilities) return no('no-code')
  if (s.index.chunks.length === 0) return no('empty-kb')
  // A benchmark of a database that does not match the decisions on screen would be a lie.
  if (isStale(currentBuildPlan(s))) return no('stale-kb')
  if (requests === 0) return no('no-cases')
  if (left !== null && left < requests) return no('quota')
  return { ok: true, requests, left }
}

// ---------------------------------------------------------------- run loop

/** Errors after which further cases would fail the same way (a rate limit would turn the rest into noise). */
function stopsTheRun(code: string | undefined): boolean {
  if (!code) return false
  return code === 'quota_exceeded' || code === 'rate_limited' || new ApiError(code as ApiError['code'], '').isAuthError
}

/** Does the knowledge base still match the one the run started on (and the decisions on screen)? */
function sameIndex(run: BenchmarkRun, s: AppState): boolean {
  return JSON.stringify(indexSnapshot(s)) === JSON.stringify(run.index) && !isStale(currentBuildPlan(s))
}

const isOurs = (runId: string) => getState().bench.runs.some((r) => r.id === runId)

function patchRun(runId: string, fn: (r: BenchmarkRun) => BenchmarkRun): BenchmarkRun | null {
  let next: BenchmarkRun | null = null
  setState((s) => ({ bench: { ...s.bench, runs: s.bench.runs.map((r) => (r.id === runId ? (next = fn(r)) : r)) } }))
  return next
}

async function save(r: BenchmarkRun | null): Promise<void> {
  // A reset or a language switch removed the run meanwhile: do not write it back.
  if (!r || !isOurs(r.id)) return
  await vectorStore()?.putBenchRun(r).catch(() => undefined)
}

function scoreCase(c: BenchmarkCase, q: QueryRun, runId: string): CaseResult {
  const s = getState()
  const docOf = new Map(s.index.chunks.map((x) => [x.id, x.docId]))
  const ranked = (q.search.ranked ?? []).map((x) => ({ docId: docOf.get(x.chunkId) ?? x.chunkId.split('#')[0], rank: x.rank, score: x.score }))
  const answerText = q.generate.answer
  return {
    caseId: c.id,
    runId,
    status: 'done',
    retrieval: scoreRetrieval({
      expectedDocIds: c.expectedDocIds,
      contextDocIds: (q.context.docs ?? []).map((d) => d.docId),
      ranked,
      indexedDocIds: Object.keys(s.index.documents),
      flagOf: docFlag,
    }),
    answer: scoreAnswer(answerText, c.keyFacts, c.mustNotContain),
    answerText,
    override: null,
    queryRunId: q.id,
  }
}

export async function runBenchmark(filter: RunFilter = {}): Promise<void> {
  const s = getState()
  if (!canRun(filter, s).ok) return
  const cases = plannedCases(filter, s)
  const signal = benchmarkSignal()
  const run: BenchmarkRun = {
    id: uid('bench'),
    createdAt: Date.now(),
    lang: s.settings.lang,
    index: indexSnapshot(s),
    topK: s.settings.topK,
    threshold: s.settings.threshold,
    caseIds: cases.map((c) => c.id),
    totalActive: activeCases(s).length,
    status: 'running',
    results: [],
    caseInfo: Object.fromEntries(
      cases.map((c) => [c.id, { kind: c.kind, question: c.question, expectedDocTitles: c.expectedDocIds.map((id) => getCorpus(s.settings.lang).docById[id]?.title ?? id) }]),
    ),
  }
  setState((st) => {
    const bench = { ...st.bench, runs: [...st.bench.runs, run], currentRunId: run.id }
    // Traces of older benchmark runs go (their query vectors add up); the chat's runs stay.
    return { bench, runs: pruneBenchTraces({ ...st, bench }) }
  })
  await save(run)
  let end: { status: 'done' | 'cancelled' | 'error'; error?: string } = { status: 'done' }
  for (const c of cases) {
    if (signal.aborted) {
      end = { status: 'cancelled' }
      break
    }
    // Safety net behind the build guard: a run never measures another database than the one it records.
    if (!sameIndex(run, getState())) {
      end = { status: 'error', error: t().lab.benchmark.indexChanged }
      break
    }
    const q = await runQuery(c.question, { ragEnabled: true, compare: false, topK: run.topK, threshold: run.threshold, toChat: false, signal })
    if (!isOurs(run.id)) return
    const failed = q.generate.status === 'error'
    if (signal.aborted && failed) {
      // The case was cut off by the cancel: it is skipped, not failed. (One that finished first keeps its result.)
      end = { status: 'cancelled' }
      break
    }
    const result: CaseResult = failed
      ? { caseId: c.id, runId: run.id, status: 'error', retrieval: null, answer: null, answerText: '', error: q.generate.error, override: null, queryRunId: q.id }
      : scoreCase(c, q, run.id)
    await save(patchRun(run.id, (r) => ({ ...r, results: [...r.results, result] })))
    if (failed && stopsTheRun(q.generate.errorCode)) {
      end = { status: 'error', error: q.generate.error }
      break
    }
  }
  if (!isOurs(run.id)) return
  const closed = patchRun(run.id, (r) => closeBenchRun(r, end.status, end.error))
  setState((st) => ({ bench: { ...st.bench, currentRunId: st.bench.currentRunId === run.id ? null : st.bench.currentRunId } }))
  await save(closed)
}

export function cancelBenchmark(): void {
  abortBenchmark()
}

/** The student's own verdict on a finished case (null takes it back). Cases that did not finish cannot be judged. */
export async function setOverride(runId: string, caseId: string, v: 'pass' | 'fail' | null): Promise<void> {
  const run = getState().bench.runs.find((r) => r.id === runId)
  const res = run?.results.find((r) => r.caseId === caseId)
  if (!res || res.status !== 'done' || res.override === v) return
  await save(patchRun(runId, (r) => ({ ...r, results: r.results.map((x) => (x.caseId === caseId ? { ...x, override: v } : x)) })))
}

// ---------------------------------------------------------------- the user's own cases

/** Add a case (no id) or edit one of the user's own cases; always in the current language. */
export async function saveCase(c: Omit<BenchmarkCase, 'builtIn' | 'lang' | 'id'> & { id?: string }): Promise<void> {
  const s = getState()
  if (c.id && !s.bench.customCases.some((x) => x.id === c.id)) return // built-in or unknown: not editable
  const saved: BenchmarkCase = { ...c, id: c.id ?? uid('case'), lang: s.settings.lang, builtIn: false }
  setState((st) => {
    const list = st.bench.customCases
    const customCases = list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved]
    return { bench: { ...st.bench, customCases } }
  })
  await vectorStore()?.putBenchCase(saved).catch(() => undefined)
}

/** Delete one of the user's own cases; built-in cases can only be switched off. */
export async function deleteCase(id: string): Promise<void> {
  if (!getState().bench.customCases.some((c) => c.id === id)) return
  setState((s) => ({ bench: { ...s.bench, customCases: s.bench.customCases.filter((c) => c.id !== id), ticked: s.bench.ticked.filter((x) => x !== id) } }))
  if (getState().settings.benchOff.includes(id)) setSettings({ benchOff: getState().settings.benchOff.filter((x) => x !== id) })
  await vectorStore()?.deleteBenchCase(id).catch(() => undefined)
}

export function toggleCase(id: string, active: boolean): void {
  const off = getState().settings.benchOff.filter((x) => x !== id)
  setSettings({ benchOff: active ? off : [...off, id] })
}

// ---------------------------------------------------------------- export

/** Download every run of this language as CSV, one row per case result. */
export function downloadRunsCsv(): void {
  const s = getState()
  const tx = t().lab.benchmark
  const csv = buildRunsCsv(s.bench.runs, allCases(s), tx.csv, (k) => t().lab.chat.labelNames[k] ?? k)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${tx.fileName}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  setUi({ benchExported: true })
}
