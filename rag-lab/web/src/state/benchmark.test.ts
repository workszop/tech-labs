import 'fake-indexeddb/auto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', async (orig) => {
  const real = await orig<typeof import('@/api/client')>()
  return {
    ...real,
    api: {
      ...real.api,
      embed: vi.fn(),
      chat: vi.fn(),
      usage: vi.fn(async () => null),
    },
  }
})

import { api, ApiError } from '@/api/client'
import { BUILT_IN_CASES } from '@/data/benchmark'
import { getCorpus } from '@/data/corpus'
import { CASE_KINDS, containsTerm, type BenchmarkCase } from '@/rag/benchmark'
import { openVectorStore, type ChunkRecord, type IndexedDocRecord } from '@/rag/db'
import { benchmarkRunning, buildIndex, docHash, docText, initApp, resetKnowledgeBase, setLang, toggleSelect } from './actions'
import { activeCases, allCases, canRun, cancelBenchmark, deleteCase, hasFullRun, plannedCases, runBenchmark, runCost, saveCase, setOverride, setTicked, toggleCase } from './benchmark'
import { partMark } from './nav'
import { DEFAULT_SETTINGS, getState, setState, type BenchmarkRun } from './store'

// The Worker sends the quota with every response (shared/api-types.ts), so the mocks do too.
const embedOk = async () => ({ embeddings: [[1, 0]], model: 'm', dimensions: 2, usage: { inputTokens: 3 }, quota: usage })
const chatOk = async () => ({ answer: 'ok [1]', prompt: undefined, usage: undefined, finishReason: 'stop', quota: usage })

function chunk(docId: string, vector: number[]): ChunkRecord {
  return {
    id: `${docId}#0`, docId, docTitle: `Doc ${docId}`, folder: 'f', chunkIndex: 0, text: `text ${docId}`, start: 0, end: 10, tokens: 3,
    overlapPrevChars: 0, overlapNextChars: 0, vector: new Float32Array(vector), model: 'm', dimensions: 2, docHash: 'h', createdAt: 0,
  }
}

const usage = { requestsUsed: 0, requestLimit: 100, tokensUsed: 0, tokenLimit: 100000, estimatedCostUsd: 0, codeExpiresAt: null }
let documents: Record<string, IndexedDocRecord> = {}

function seed() {
  setState({
    settings: { ...DEFAULT_SETTINGS, lang: 'pl', benchOff: [] },
    bench: { customCases: [], runs: [], currentRunId: null, ticked: [] },
    chat: [], runs: {}, activeRunId: null,
    usage,
    auth: {
      status: 'active', notice: null,
      session: {
        sessionRef: 'x', label: null, expiresAt: '', usage,
        capabilities: { provider: 'mock', embeddingModel: 'm', embeddingDimensions: 2, chatModel: 'c', maxEmbeddingBatch: 8, maxEmbeddingInputTokens: 1000, maxContextChunks: 8, maxChatInputTokens: 8000, maxQuestionChars: 1000, maxOutputTokens: { min: 1, max: 1000, default: 500 }, temperature: { min: 0, max: 1, default: 0.2 }, streaming: true },
      } as never,
    },
    index: {
      meta: { key: 'index', model: 'm', dimensions: 2, chunkSize: 400, overlap: 60, labels: 'none', tokenizer: 't', createdAt: 0, updatedAt: 0 },
      chunks: [chunk('proces-04', [1, 0]), chunk('proces-06', [0, 1])],
      documents,
    },
    selection: ['proces-04', 'proces-06'],
  })
}

async function storedRuns(): Promise<BenchmarkRun[]> {
  return (await (await openVectorStore()).loadBenchmark()).runs
}

beforeAll(async () => {
  await initApp()
  const corpus = getCorpus('pl')
  const rec = async (id: string): Promise<IndexedDocRecord> => ({ docId: id, title: id, folder: 'f', docHash: await docHash(corpus.docById[id]), chunkCount: 1, tokens: 3, indexedAt: 0 })
  documents = { 'proces-04': await rec('proces-04'), 'proces-06': await rec('proces-06') }
})

beforeEach(async () => {
  vi.mocked(api.embed).mockReset().mockImplementation(embedOk as never)
  vi.mocked(api.chat).mockReset().mockImplementation(chatOk as never)
  vi.mocked(api.usage).mockReset().mockImplementation(async () => usage)
  await (await openVectorStore()).clearBenchRuns()
  seed()
})

describe('built-in cases', () => {
  it.each(['pl', 'en'] as const)('%s: one case per kind', (lang) => {
    const cases = BUILT_IN_CASES[lang]
    expect(cases.map((c) => c.kind)).toEqual(CASE_KINDS)
    expect(new Set(cases.map((c) => c.question)).size).toBe(cases.length)
    expect(cases.every((c) => c.builtIn && c.lang === lang && c.expectedAnswer.length > 0)).toBe(true)
  })
  it.each(['pl', 'en'] as const)('%s: every key fact occurs in an expected document', (lang) => {
    const corpus = getCorpus(lang)
    for (const c of BUILT_IN_CASES[lang]) {
      const texts = c.expectedDocIds.map((id) => docText(corpus.docById[id]))
      for (const group of c.keyFacts) for (const spelling of group) expect(texts.some((t) => containsTerm(t, spelling)), `${c.id}: ${spelling}`).toBe(true)
    }
  })
  it('the forbidden phone number is in the complaints register in both languages', () => {
    for (const lang of ['pl', 'en'] as const) {
      const all = getCorpus(lang).documents.map(docText).join('\n')
      expect(all).toContain('500 000 111')
    }
  })
})

describe('planning a run', () => {
  it('costs two requests per case', () => expect(runCost(20)).toEqual({ requests: 40 }))
  it('refuses to start when the quota cannot cover the run', () => {
    setState({ usage: { ...usage, requestLimit: 10, requestsUsed: 5 } }) // 5 left, 4 cases need 8
    expect(canRun()).toMatchObject({ ok: false, reason: 'quota', requests: 8, left: 5 })
    setState({ usage: { ...usage, requestLimit: 10, requestsUsed: 2 } }) // exactly enough
    expect(canRun()).toMatchObject({ ok: true, requests: 8, left: 8 })
  })
  it('refuses to start while the remaining quota is unknown', () => {
    setState({ usage: null })
    expect(canRun()).toMatchObject({ ok: false, reason: 'quota', requests: 8, left: null })
  })
  it('refuses without an access code', () => {
    setState({ auth: { status: 'browsing', session: null, notice: null } })
    expect(canRun()).toMatchObject({ ok: false, reason: 'no-code' })
  })
  it('refuses on an empty knowledge base and on a stale one', () => {
    expect(canRun()).toMatchObject({ ok: true })
    setState({ index: { ...getState().index, chunks: [] } })
    expect(canRun()).toMatchObject({ ok: false, reason: 'empty-kb' })
    seed()
    toggleSelect(['proces-06'], false)
    expect(canRun()).toMatchObject({ ok: false, reason: 'stale-kb' })
  })
  it('refuses when no case is planned', () => {
    expect(canRun({ ids: [] })).toMatchObject({ ok: false, reason: 'no-cases', requests: 0 })
  })
  it('skips switched-off cases', () => {
    toggleCase('b-missing-1', false)
    expect(activeCases().map((c) => c.id)).not.toContain('b-missing-1')
    expect(allCases().map((c) => c.id)).toContain('b-missing-1')
    expect(canRun().requests).toBe(6)
    toggleCase('b-missing-1', true)
    expect(activeCases()).toHaveLength(4)
  })
  it('narrows the plan by kind and by ids', () => {
    expect(plannedCases({ kind: 'exception' }).map((c) => c.id)).toEqual(['b-exception-1'])
    expect(plannedCases({ ids: ['b-restricted-1', 'b-ordinary-1'] }).map((c) => c.id)).toEqual(['b-ordinary-1', 'b-restricted-1'])
  })
})

describe('the run loop', () => {
  it('runs every active case, keeps them out of the chat and stores the run', async () => {
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('done')
    expect(run.results.map((r) => r.status)).toEqual(['done', 'done', 'done', 'done'])
    expect(run.results.every((r) => r.runId === run.id && r.retrieval && r.answer)).toBe(true)
    expect(getState().chat).toHaveLength(0)
    expect(getState().bench.currentRunId).toBeNull()
    const stored = await storedRuns()
    expect(stored.map((r) => r.id)).toEqual([run.id])
    expect(stored[0].results).toHaveLength(4)
  })
  it('scores retrieval against the expected documents', async () => {
    await runBenchmark({ kind: 'ordinary' })
    const r = getState().bench.runs.at(-1)!.results[0]
    // The query vector [1, 0] finds proces-04 first; top-k 3 takes both fragments.
    expect(r.retrieval).toMatchObject({ applicable: true, pass: true, share: 1 })
    expect(r.answer?.pass).toBe(false) // "ok [1]" does not state the limit
  })
  it('saves the run after every case', async () => {
    const seen: number[] = []
    vi.mocked(api.chat).mockImplementation((async () => {
      const runs = await storedRuns()
      seen.push(runs[0]?.results.length ?? -1)
      return chatOk()
    }) as never)
    await runBenchmark()
    expect(seen).toEqual([0, 1, 2, 3])
  })
  it('narrows a run to one kind and marks it as not full', async () => {
    await runBenchmark({ kind: 'restricted' })
    const run = getState().bench.runs.at(-1)!
    expect(run.caseIds).toEqual(['b-restricted-1'])
    expect(run.totalActive).toBe(4)
  })
  it('stops on a quota error and skips the rest', async () => {
    vi.mocked(api.chat).mockImplementationOnce(chatOk as never).mockRejectedValue(new ApiError('quota_exceeded', 'The code is spent.', 402))
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('error')
    expect(run.results.map((r) => r.status)).toEqual(['done', 'error', 'skipped', 'skipped'])
    expect(run.results[1].error).toBe('The code is spent.')
    expect((await storedRuns())[0].status).toBe('error')
  })
  it('records an ordinary failure and goes on', async () => {
    vi.mocked(api.chat).mockImplementationOnce(chatOk as never).mockRejectedValueOnce(new ApiError('upstream_unavailable', 'Model down.', 502))
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('done')
    expect(run.results.map((r) => r.status)).toEqual(['done', 'error', 'done', 'done'])
  })
  it('cancels: the remaining cases are skipped', async () => {
    vi.mocked(api.chat).mockImplementation((async (_req: unknown, _cb: unknown, signal: AbortSignal) => {
      if (vi.mocked(api.chat).mock.calls.length === 2) {
        cancelBenchmark()
        if (signal.aborted) throw new ApiError('aborted', 'aborted')
      }
      return chatOk()
    }) as never)
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('cancelled')
    expect(run.results.map((r) => r.status)).toEqual(['done', 'skipped', 'skipped', 'skipped'])
    expect((await storedRuns())[0].status).toBe('cancelled')
  })
  it('stops on a rate limit and skips the rest', async () => {
    vi.mocked(api.chat).mockImplementationOnce(chatOk as never).mockRejectedValue(new ApiError('rate_limited', 'Too many requests.', 429))
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('error')
    expect(run.results.map((r) => r.status)).toEqual(['done', 'error', 'skipped', 'skipped'])
  })
  it('stops when the knowledge base changes between cases', async () => {
    vi.mocked(api.chat).mockImplementation((async () => {
      if (vi.mocked(api.chat).mock.calls.length === 2) setState({ index: { ...getState().index, chunks: getState().index.chunks.slice(0, 1) } })
      return chatOk()
    }) as never)
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('error')
    expect(run.error).toBeTruthy()
    expect(run.results.map((r) => r.status)).toEqual(['done', 'done', 'skipped', 'skipped'])
    expect((await storedRuns())[0].status).toBe('error')
  })
  it('refuses to build or remove documents while a run is in progress', async () => {
    let release!: () => void
    vi.mocked(api.chat).mockImplementationOnce((() => new Promise((res) => (release = () => res(chatOk() as never)))) as never)
    const first = runBenchmark()
    await vi.waitFor(() => expect(release).toBeDefined())
    expect(benchmarkRunning(getState())).toBe(true)
    toggleSelect(['proces-06'], false) // a build would now remove proces-06
    await buildIndex()
    expect(getState().index.chunks).toHaveLength(2)
    expect(getState().job).toBeNull()
    release()
    await first
    expect(benchmarkRunning(getState())).toBe(false)
  })
  it('keeps what the export needs about each planned case with the run', async () => {
    await saveCase({ kind: 'missing', question: 'Własne pytanie?', expectedDocIds: ['proces-06'], expectedAnswer: '', keyFacts: [], mustNotContain: [] })
    const own = getState().bench.customCases[0]
    await runBenchmark()
    await deleteCase(own.id)
    const run = getState().bench.runs.at(-1)!
    expect(run.caseInfo?.[own.id]).toEqual({ kind: 'missing', question: 'Własne pytanie?', expectedDocTitles: ['PROCES-06 Wstrzymanie i zwolnienie partii'] })
    expect(run.caseInfo?.['b-ordinary-1']?.expectedDocTitles).toEqual(['PROCES-04 Obsługa reklamacji'])
  })
  it('does not start a second run while one is running', async () => {
    let release!: () => void
    vi.mocked(api.chat).mockImplementationOnce((() => new Promise((res) => (release = () => res(chatOk() as never)))) as never)
    const first = runBenchmark()
    await vi.waitFor(() => expect(release).toBeDefined())
    expect(canRun()).toMatchObject({ ok: false, reason: 'running' })
    await runBenchmark()
    expect(getState().bench.runs).toHaveLength(1)
    release()
    await first
  })
  it('turns a run left running by a reload into a cancelled one', async () => {
    const store = await openVectorStore()
    const done = { caseId: 'b-ordinary-1', runId: 'r-old', status: 'done' as const, retrieval: null, answer: null, answerText: 'a', override: null }
    await store.putBenchRun({ id: 'r-old', createdAt: 5, lang: 'pl', index: { docIds: [], docTitles: [], chunkSize: 400, overlap: 60, labels: 'none', chunks: 2 }, topK: 3, threshold: null, caseIds: ['b-ordinary-1', 'b-exception-1', 'b-missing-1'], totalActive: 4, status: 'running', results: [done] })
    await initApp()
    const run = getState().bench.runs.find((r) => r.id === 'r-old')!
    expect(run.status).toBe('cancelled')
    expect(run.results.map((r) => [r.caseId, r.status])).toEqual([['b-ordinary-1', 'done'], ['b-exception-1', 'skipped'], ['b-missing-1', 'skipped']])
    expect((await storedRuns()).find((r) => r.id === 'r-old')!.status).toBe('cancelled')
  })
})

describe('benchmark traces', () => {
  it('links each result to its query run and keeps only the traces of the latest two runs', async () => {
    const { ask } = await import('./actions')
    await ask('pytanie z czatu')
    const chatRun = getState().chat[0].runId
    await runBenchmark()
    const first = getState().bench.runs.at(-1)!
    expect(first.results.every((r) => r.queryRunId && getState().runs[r.queryRunId])).toBe(true)
    await runBenchmark()
    await runBenchmark()
    const [, second, third] = getState().bench.runs
    const traces = (r: BenchmarkRun) => r.results.map((x) => x.queryRunId!)
    expect(Object.keys(getState().runs).sort()).toEqual([chatRun, ...traces(second), ...traces(third)].sort())
    expect(traces(first).some((id) => getState().runs[id])).toBe(false)
  })
})

describe('a full run (guide step 6)', () => {
  it('a run that ended done with one case in error is not full', async () => {
    vi.mocked(api.chat).mockImplementationOnce(chatOk as never).mockRejectedValueOnce(new ApiError('upstream_unavailable', 'Model down.', 502))
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    expect(run.status).toBe('done')
    expect(hasFullRun(getState().bench.runs)).toBe(false)
  })
  it('a run of one kind is not full', async () => {
    await runBenchmark({ kind: 'restricted' })
    expect(hasFullRun(getState().bench.runs)).toBe(false)
  })
  it('a run where every active case finished is full', async () => {
    await runBenchmark()
    expect(hasFullRun(getState().bench.runs)).toBe(true)
  })
})

describe('ticked cases', () => {
  it('ticks and unticks a case once', () => {
    setTicked('b-ordinary-1', true)
    setTicked('b-ordinary-1', true)
    expect(getState().bench.ticked).toEqual(['b-ordinary-1'])
    setTicked('b-ordinary-1', false)
    expect(getState().bench.ticked).toEqual([])
  })
})

describe('overrides', () => {
  it('overrides a finished case and stores it, and refuses on a case that did not finish', async () => {
    vi.mocked(api.chat).mockImplementationOnce(chatOk as never).mockRejectedValue(new ApiError('quota_exceeded', 'spent', 402))
    await runBenchmark()
    const run = getState().bench.runs.at(-1)!
    await setOverride(run.id, 'b-ordinary-1', 'pass')
    await setOverride(run.id, 'b-exception-1', 'pass') // error
    await setOverride(run.id, 'b-missing-1', 'pass') // skipped
    const after = getState().bench.runs.at(-1)!
    expect(after.results.map((r) => r.override)).toEqual(['pass', null, null, null])
    expect((await storedRuns())[0].results[0].override).toBe('pass')
    await setOverride(run.id, 'b-ordinary-1', null)
    expect(getState().bench.runs.at(-1)!.results[0].override).toBeNull()
  })
  it('the parts bar shows the passed count of the latest run', async () => {
    expect(partMark('benchmark', getState())).toBeNull()
    await runBenchmark()
    // Only the restricted case passes on "ok [1]": no forbidden string, no expected document.
    expect(partMark('benchmark', getState())).toBe(1)
  })
})

describe('custom cases', () => {
  const draft = { kind: 'ordinary' as const, question: 'Ile dni na odpowiedź?', expectedDocIds: ['proces-04'], expectedAnswer: '14 dni.', keyFacts: [['14 dni']], mustNotContain: [] }
  it('saves, edits and deletes a custom case of the current language', async () => {
    await saveCase(draft)
    const c = getState().bench.customCases[0]
    expect(c).toMatchObject({ lang: 'pl', builtIn: false, question: draft.question })
    expect(allCases().at(-1)!.id).toBe(c.id)
    await saveCase({ ...draft, id: c.id, question: 'Ile dni?' })
    expect(getState().bench.customCases.map((x) => x.question)).toEqual(['Ile dni?'])
    expect((await (await openVectorStore()).loadBenchmark()).cases.map((x) => x.question)).toEqual(['Ile dni?'])
    await deleteCase('b-ordinary-1') // built-in: refused
    expect(allCases()).toHaveLength(5)
    await deleteCase(c.id)
    expect(getState().bench.customCases).toHaveLength(0)
    expect((await (await openVectorStore()).loadBenchmark()).cases).toHaveLength(0)
  })
  it('does not let an edit overwrite a built-in case', async () => {
    await saveCase({ ...draft, id: 'b-ordinary-1' })
    expect(getState().bench.customCases).toHaveLength(0)
  })
})

describe('clearing runs', () => {
  async function withRunAndCase(): Promise<BenchmarkCase> {
    await saveCase({ kind: 'missing', question: 'Q?', expectedDocIds: [], expectedAnswer: '', keyFacts: [], mustNotContain: [] })
    await runBenchmark({ kind: 'restricted' })
    expect(getState().bench.runs).toHaveLength(1)
    return getState().bench.customCases[0]
  }
  it('clears runs on reset and keeps custom cases', async () => {
    const c = await withRunAndCase()
    await resetKnowledgeBase()
    expect(getState().bench.runs).toHaveLength(0)
    expect(await storedRuns()).toHaveLength(0)
    expect(getState().bench.customCases.map((x) => x.id)).toEqual([c.id])
    await deleteCase(c.id)
  })
  it('clears runs on language switch and keeps custom cases', async () => {
    const c = await withRunAndCase()
    await setLang('en')
    expect(getState().bench.runs).toHaveLength(0)
    expect(await storedRuns()).toHaveLength(0)
    expect(getState().bench.customCases.map((x) => x.id)).toEqual([c.id])
    expect(allCases().map((x) => x.id)).not.toContain(c.id) // a Polish case is not part of the English benchmark
    expect((await (await openVectorStore()).loadBenchmark()).cases.map((x) => x.id)).toEqual([c.id])
    await setLang('pl')
    await deleteCase(c.id)
  })
})
