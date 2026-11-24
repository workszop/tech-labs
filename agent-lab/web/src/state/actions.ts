/**
 * App actions: session and language, and the agent run orchestration. This is
 * where the engine gets its real dependencies (Worker client, tools, knowledge
 * search, confirmation through the chat) and where state is persisted.
 */
import type { Lang, SessionInfo, ValidatedToolCall } from '@shared/api-types'
import { TOOL_NAMES, isToolName, type ToolName } from '@shared/tools'
import { t } from '@/i18n'
import { api, ApiError, onAuthLost } from '@/api/client'
import { runAgent } from '@/agent/engine'
import { boundHistory, MAX_STORED_RUNS } from '@/agent/limits'
import { noticeKeyFor, type ChatItem, type EngineDeps, type RunRecord, type RunResult } from '@/agent/types'
import { SCENARIOS } from '@/data/scenarios'
import { loadCorpus } from '@/kb/indexer'
import { indexKnowledgeBase, indexStatus, searchKnowledge, type EmbedFn } from '@/kb/search'
import { resetSimulation, seedIfEmpty, simDb } from '@/sim/db'
import {
  clearConversation,
  clearRuns,
  closingEvents,
  loadConversation,
  loadPrefs,
  loadRuns,
  pruneRuns,
  restoreConversationItems,
  saveConversation,
  savePrefs,
  saveRun,
} from '@/sim/runs'
import { executeTool } from '@/sim/tools'
import {
  DEFAULT_CUSTOMER_ID,
  DEFAULT_TOOLS,
  getState,
  newConversationId,
  setSettings,
  setState,
  type KbIndexState,
  type TraceSelection,
} from './store'

// ---------------------------------------------------------------- persistence

/** IndexedDB writes run one after another, in the order the state changed. */
let writeChain: Promise<void> = Promise.resolve()
function persist(task: () => Promise<unknown>) {
  writeChain = writeChain.then(task).then(
    () => undefined,
    () => undefined, // storage blocked or full: the app keeps working in memory
  )
}
/** Resolves when every queued write is done. */
export function persistenceIdle(): Promise<void> {
  return writeChain
}

function persistConversation() {
  const s = getState()
  const snapshot = { conversationId: s.conversationId, customerId: s.activeCustomerId, lang: s.settings.lang, items: s.conversation, history: s.history }
  persist(() => saveConversation(snapshot))
}

function persistPrefs() {
  const s = getState()
  const snapshot = { lang: s.settings.lang, activeCustomerId: s.activeCustomerId, enabledTools: s.enabledTools }
  persist(() => savePrefs(snapshot))
}

function persistRun(runId: string) {
  const run = getState().runs.find((r) => r.id === runId)
  if (run) persist(() => saveRun(run))
}

/** Restores the company data, preferences, conversation and runs from IndexedDB. */
async function restoreState(): Promise<void> {
  try {
    await seedIfEmpty()
    const [prefs, conv, { runs, interrupted }] = await Promise.all([loadPrefs(), loadConversation(), loadRuns()])
    const lang = getState().settings.lang
    const customerOk = prefs?.activeCustomerId ? !!(await simDb.customers.get(prefs.activeCustomerId)) : false
    const activeCustomerId = customerOk ? prefs!.activeCustomerId : DEFAULT_CUSTOMER_ID
    const enabledTools = prefs ? TOOL_NAMES.filter((n) => prefs.enabledTools.includes(n)) : [...DEFAULT_TOOLS]
    // Model history is per conversation, customer and language: a mismatch starts a new conversation.
    const same = conv && conv.customerId === activeCustomerId && conv.lang === lang ? conv : null
    setState({
      ready: true,
      activeCustomerId,
      enabledTools,
      runs,
      conversationId: same ? same.conversationId : newConversationId(),
      conversation: same ? restoreConversationItems(same.items, interrupted, Date.now()) : [],
      history: same ? same.history : [],
    })
  } catch {
    // IndexedDB unavailable or partly unreadable: run in memory only, and do not
    // overwrite what is stored with the empty in-memory state.
    setState({ ready: true })
    return
  }
  persistConversation()
  persistPrefs()
}

// ---------------------------------------------------------------- session and language

export function initApp(): Promise<void> {
  onAuthLost((err) => {
    cancelRun()
    stopKbIndex()
    setState((s) => ({
      auth: { status: 'locked', session: null, notice: err.code === 'session_expired' ? t().shell.actions.sessionExpired : err.message },
      usage: s.usage,
    }))
  })
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Dev-only hook for headless checks; Vite drops this branch from production builds.
    Object.assign(window, { __agentLab: { getState, sendMessage, cancelRun, resolveConfirmation, setActiveCustomer, ensureKbIndex, persistenceIdle, repeatRun, setToolEnabled, setEnabledTools, startNewConversation, resetScenario, resetEverything } })
  }
  return restoreState()
}

/** Switch the UI language. The model history is per language, so this starts a new conversation. */
export function setLang(lang: Lang) {
  if (getState().settings.lang === lang) return
  cancelRun()
  setSettings({ lang })
  document.documentElement.lang = lang
  startNewConversation()
  persistPrefs()
  void ensureKbIndex()
}

export async function activate(code: string): Promise<SessionInfo> {
  const session = await api.activate(code)
  setState({ auth: { status: 'active', session, notice: null }, usage: session.usage })
  void ensureKbIndex()
  return session
}

export function browseWithoutActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'browsing', notice: null } }))
}

export function showActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'locked' } }))
}

export async function logout() {
  cancelRun()
  stopKbIndex()
  await api.logout().catch(() => undefined)
  setState({ auth: { status: 'locked', session: null, notice: t().shell.actions.loggedOut } })
}

export async function refreshUsage() {
  try {
    const usage = await api.usage()
    setState({ usage })
  } catch {
    /* auth errors are handled by onAuthLost */
  }
}

// ---------------------------------------------------------------- knowledge base

/** Embeds through the Worker; `model` is the session's embedding model, so an index built with another model counts as stale. */
function embedFnFor(session: SessionInfo, signal?: AbortSignal): EmbedFn {
  const fn = async (texts: string[], lang: Lang) => {
    const r = await api.embed(texts, signal, lang)
    setState({ usage: r.quota })
    return { model: r.model, embeddings: r.embeddings }
  }
  return Object.assign(fn, { model: session.capabilities.embeddingModel })
}

let kbTask: { lang: Lang; ctl: AbortController; promise: Promise<void> } | null = null

function stopKbIndex() {
  kbTask?.ctl.abort()
  kbTask = null
}

/**
 * Builds the knowledge base index of the current language when it is missing or
 * stale (other embedding model or documents), reporting progress in `kbIndex`.
 */
export function ensureKbIndex(): Promise<void> {
  const s = getState()
  const session = s.auth.session
  if (s.auth.status !== 'active' || !session) return Promise.resolve()
  const lang = s.settings.lang
  if (kbTask && kbTask.lang === lang) return kbTask.promise
  stopKbIndex()
  const ctl = new AbortController()
  const embed = embedFnFor(session, ctl.signal)
  const model = session.capabilities.embeddingModel
  const set = (patch: Partial<KbIndexState>) => {
    if (!ctl.signal.aborted) setState((st) => ({ kbIndex: { ...st.kbIndex, lang, error: null, ...patch } }))
  }
  const promise = (async () => {
    set({ status: 'checking', done: 0, total: 0 })
    try {
      if ((await indexStatus(lang, model)) === 'ready') {
        const total = (await loadCorpus(lang)).chunks.length
        set({ status: 'ready', done: total, total })
        return
      }
      const info = await indexKnowledgeBase(lang, embed, (done, total) => set({ status: 'indexing', done, total }), ctl.signal)
      set({ status: 'ready', done: info.chunks, total: info.chunks })
    } catch (e) {
      if (!ctl.signal.aborted) set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    } finally {
      if (kbTask?.ctl === ctl) kbTask = null
    }
  })()
  kbTask = { lang, ctl, promise }
  return promise
}

// ---------------------------------------------------------------- conversation and runs

let runCtl: AbortController | null = null
/** The run in progress (from the first await of `sendMessage` until its results are stored). */
let runDone: Promise<void> | null = null
let decide: ((approved: boolean) => void) | null = null

function addItems(...items: ChatItem[]) {
  setState((s) => ({ conversation: [...s.conversation, ...items] }))
}

function updateRun(runId: string, fn: (r: RunRecord) => RunRecord) {
  setState((s) => ({ runs: s.runs.map((r) => (r.id === runId ? fn(r) : r)) }))
}

/** Shows the confirmation card and waits for `resolveConfirmation` (or the run's abort: nothing is executed then). */
function askConfirmation(runId: string, call: ValidatedToolCall, signal: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) return resolve(false)
    const itemId = `confirm-${runId}-${call.id}`
    const conversationId = getState().conversationId
    const done = (approved: boolean | null) => {
      decide = null
      signal.removeEventListener('abort', onAbort)
      const state = approved === null ? 'cancelled' : approved ? 'approved' : 'rejected'
      setState((s) => ({
        pendingConfirmation: null,
        conversation: s.conversation.map((i) => (i.id === itemId && i.kind === 'confirmation' ? { ...i, state } : i)),
      }))
      if (getState().conversationId === conversationId) persistConversation()
      resolve(approved === true)
    }
    const onAbort = () => done(null)
    addItems({ kind: 'confirmation', id: itemId, runId, callId: call.id, call, state: 'pending', at: Date.now() })
    setState({ pendingConfirmation: { runId, call } })
    persistConversation()
    signal.addEventListener('abort', onAbort, { once: true })
    decide = done
  })
}

/** The user's decision on the pending confirmation card. */
export function resolveConfirmation(approved: boolean) {
  decide?.(approved)
}

export function cancelRun() {
  runCtl?.abort()
}

/** Options of `sendMessage` used by the experiments ("Repeat this question"). */
export interface SendOptions {
  /** Id of the run whose question is sent again; stored on the new run as `repeatOf`. */
  repeatOf?: string
}

/** Why a message cannot be sent now (localized), or null when it can. */
function sendBlocker(): Error | null {
  const tx = t().shell
  if (!getState().ready) return new Error(tx.runErrors.notReady)
  if (runDone || getState().currentRun) return new Error(tx.runErrors.busy)
  if (getState().auth.status !== 'active' || !getState().auth.session) return new ApiError('unauthorized', tx.errors.activateFirst, 401)
  return null
}

/**
 * Sends a customer message: starts a run of the agent loop for the active
 * customer. With a scenario id, the scenario's customer becomes active first.
 * Resolves when the run has ended.
 */
export function sendMessage(text: string, scenarioId?: string, opts: SendOptions = {}): Promise<void> {
  const tx = t().shell
  const blocked = sendBlocker()
  if (blocked) return Promise.reject(blocked)
  const session = getState().auth.session!
  const message = text.trim()
  if (!message) return Promise.resolve()
  const max = session.capabilities.agent.maxMessageChars
  if (message.length > max) return Promise.reject(new Error(tx.runErrors.tooLong(max)))
  const done = runMessage(session, message, scenarioId, opts).finally(() => {
    if (runDone === done) runDone = null
  })
  runDone = done
  return done
}

async function runMessage(session: SessionInfo, message: string, scenarioId: string | undefined, opts: SendOptions): Promise<void> {
  // Registered before the first await, so `cancelRun` (also through a customer or
  // language switch) stops this message even while the run is being set up.
  const ctl = new AbortController()
  runCtl = ctl
  try {
    await startRun(ctl, session, message, scenarioId, opts)
  } finally {
    if (runCtl === ctl) runCtl = null
  }
}

async function startRun(ctl: AbortController, session: SessionInfo, message: string, scenarioId: string | undefined, opts: SendOptions): Promise<void> {
  const scenario = scenarioId ? SCENARIOS.find((x) => x.id === scenarioId) : undefined
  // Scenario customers are seed customers; the switch must not cancel this run.
  if (scenario && scenario.customerId !== getState().activeCustomerId) switchCustomer(scenario.customerId)
  const customer = await simDb.customers.get(getState().activeCustomerId)
  if (ctl.signal.aborted) return

  // Snapshot after the last await: nothing can change it unnoticed from here (a switch cancels `ctl`).
  const s = getState()
  const customerId = s.activeCustomerId
  const lang = s.settings.lang
  const enabledTools = [...s.enabledTools]
  const conversationId = s.conversationId
  const history = boundHistory(s.history)
  const runId = crypto.randomUUID()
  const startedAt = Date.now()
  const record: RunRecord = {
    id: runId, scenarioId: scenario?.id ?? null, customerId, message, enabledTools, startedAt, events: [], model: session.capabilities.chatModel, lang,
    ...(opts.repeatOf ? { repeatOf: opts.repeatOf } : {}),
  }
  setState((st) => ({ currentRun: runId, runs: [...st.runs, record].slice(-MAX_STORED_RUNS), selectedTraceItem: null }))
  addItems({ kind: 'customer', id: `msg-${runId}`, runId, text: message, at: startedAt })
  persistRun(runId)
  persistConversation()

  const embed = embedFnFor(session)
  const deps: EngineDeps = {
    agentStep: async (req, signal) => {
      const res = await api.agentStep(req, signal)
      setState({ usage: res.quota })
      if (res.model) updateRun(runId, (r) => (r.model === res.model ? r : { ...r, model: res.model }))
      return res
    },
    executeTool,
    toolContext: { customerId, lang, searchKnowledge: (q) => searchKnowledge(q, { lang, embed }) },
    confirm: (call, signal) => askConfirmation(runId, call, signal),
    emit: (e) => {
      updateRun(runId, (r) => ({ ...r, events: [...r.events, e] }))
      persistRun(runId)
    },
    now: () => Date.now(),
  }

  let result: RunResult
  try {
    result = await runAgent({ runId, lang, customer: { id: customerId, name: customer?.name ?? customerId }, enabledTools, history, message }, deps, ctl.signal)
  } catch (e) {
    // The engine does not throw; this guards against a bug so that a run never stays "in progress":
    // open calls are closed (as `result_unknown` / `not_executed`), a pending card is cancelled.
    ctl.abort()
    decide = null
    const at = Date.now()
    const events = getState().runs.find((r) => r.id === runId)?.events ?? []
    for (const ev of closingEvents(events, at, lang)) deps.emit(ev)
    deps.emit({ type: 'run_finished', at, outcome: 'error', detail: 'unexpected', answer: '' })
    setState((st) => ({
      conversation: st.conversation.map((i) => (i.kind === 'confirmation' && i.runId === runId && i.state === 'pending' ? { ...i, state: 'cancelled' } : i)),
    }))
    result = { transcript: history, outcome: 'error', answer: '', reason: 'unexpected', detail: e instanceof Error ? e.message : String(e) }
  }

  updateRun(runId, (r) => ({ ...r, outcome: result.outcome, answer: result.answer }))
  setState((st) => ({ currentRun: st.currentRun === runId ? null : st.currentRun, pendingConfirmation: null }))
  persistRun(runId)
  persist(() => pruneRuns())
  // A switch of customer or language started a new conversation meanwhile: this run's messages stay out of it.
  if (getState().conversationId !== conversationId) return
  const at = Date.now()
  const items: ChatItem[] = []
  if (result.answer) items.push({ kind: 'agent', id: `reply-${runId}`, runId, text: result.answer, at })
  if (result.outcome !== 'answered') {
    items.push({
      kind: 'notice', id: `notice-${runId}`, runId, outcome: result.outcome, messageKey: noticeKeyFor(result.reason, result.outcome),
      ...(result.detail ? { detail: result.detail } : {}), at,
    })
  }
  setState((st) => ({ history: result.transcript, conversation: [...st.conversation, ...items] }))
  persistConversation()
}

function resetConversation() {
  setState({ conversationId: newConversationId(), conversation: [], history: [], pendingConfirmation: null, selectedTraceItem: null })
  persistConversation()
}

/** Starts an empty conversation (the model history starts again); the run log is kept. */
export function startNewConversation() {
  cancelRun()
  resetConversation()
}

/** Makes `id` the active customer with a new conversation, without touching the run in progress. */
function switchCustomer(id: string) {
  setState({ activeCustomerId: id })
  resetConversation()
  persistPrefs()
}

/** The agent serves another customer: a new conversation. */
export async function setActiveCustomer(id: string): Promise<void> {
  if (getState().activeCustomerId === id) return
  if (!(await simDb.customers.get(id))) return
  cancelRun()
  switchCustomer(id)
}

/**
 * Sends the question of a finished run again, as the same customer, with the
 * current tool switches, in a new conversation. The new run records `repeatOf`,
 * so the two runs can be compared. Rejects (and changes nothing) while a run is
 * in progress or when the agent cannot be used.
 */
export async function repeatRun(runId: string): Promise<void> {
  const blocked = sendBlocker()
  if (blocked) throw blocked
  const src = getState().runs.find((r) => r.id === runId)
  if (!src || !src.outcome) throw new Error(t().shell.runErrors.notRepeatable)
  if (!(await simDb.customers.get(src.customerId))) throw new Error(t().shell.runErrors.notReady)
  const again = sendBlocker()
  if (again) throw again
  if (getState().activeCustomerId !== src.customerId) switchCustomer(src.customerId)
  else resetConversation()
  return sendMessage(src.message, src.scenarioId ?? undefined, { repeatOf: src.id })
}

/** Turns one tool on or off for the next runs (registry order is kept). */
export function setToolEnabled(name: ToolName, on: boolean) {
  if (!isToolName(name)) return
  setState((s) => {
    const set = new Set(s.enabledTools)
    if (on) set.add(name)
    else set.delete(name)
    return { enabledTools: TOOL_NAMES.filter((n) => set.has(n)) }
  })
  persistPrefs()
}

/** Sets the whole tool choice at once (a preset of the tools panel); unknown names are ignored. */
export function setEnabledTools(names: readonly ToolName[]) {
  setState({ enabledTools: TOOL_NAMES.filter((n) => names.includes(n)) })
  persistPrefs()
}

export function selectTraceItem(sel: TraceSelection | null) {
  setState({ selectedTraceItem: sel })
}

/**
 * Restores the company data to the seed (tickets created by the agent are
 * removed), clears the runs and the conversation and resets the customer and
 * tool choice. The language and the knowledge base index are kept.
 */
export async function resetEverything(): Promise<void> {
  cancelRun()
  await runDone?.catch(() => undefined)
  await writeChain
  await Promise.all([resetSimulation(), clearRuns(), clearConversation()])
  setState({ runs: [], currentRun: null, activeCustomerId: DEFAULT_CUSTOMER_ID, enabledTools: [...DEFAULT_TOOLS] })
  startNewConversation()
  persistPrefs()
}

/**
 * "Reset this scenario": starts a new conversation as the same customer and
 * restores the company data to the seed (tickets created by the agent are
 * removed). The runs, the tool switches, the language and the knowledge base
 * index are kept.
 */
export async function resetScenario(): Promise<void> {
  cancelRun()
  await runDone?.catch(() => undefined)
  await writeChain
  await resetSimulation()
  startNewConversation()
}
