/**
 * Which run the centre panel shows, which of its events are visible (all, or a
 * prefix during a replay) and which item is selected. Selection of a trace item
 * lives in the store (`selectedTraceItem`) so the chat can select a step too;
 * the shown run and the replay are local to the panel.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunRecord } from '@/agent/types'
import { selectTraceItem } from '@/state/actions'
import { getState, useStore } from '@/state/store'
import { listRuns, pickShownRun } from './runSelection'
import { deriveTrace, type TraceView } from './trace'

export const REPLAY_SPEEDS = [0.5, 1, 2] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]
/** Time between two recorded events at speed 1 during a replay. */
const REPLAY_STEP_MS = 900

export interface ReplayState {
  runId: string
  /** Number of recorded events shown (1..events.length). */
  pos: number
  playing: boolean
  speed: ReplaySpeed
}

export interface RunView {
  /** Runs of the current conversation (the run in progress included), oldest first. */
  runs: RunRecord[]
  run: RunRecord | null
  live: boolean
  trace: TraceView
  /** Selected item id (`customer`, `model:2`, `tool:<id>`, `confirm:<id>`, `final`, `node:<node>`), or null. */
  selected: string | null
  /** True when the selection follows the newest item (live run or replay, nothing picked by the user). */
  following: boolean
  /** True when the user picked an item in a live run (the panel stopped following). */
  pinned: boolean
  replay: ReplayState | null
  pickRun: (id: string) => void
  select: (itemId: string | null) => void
  startReplay: () => void
  setReplay: (patch: Partial<Omit<ReplayState, 'runId'>>) => void
  stepReplay: (delta: 1 | -1) => void
  stopReplay: () => void
}

export function useRunView(): RunView {
  const allRuns = useStore((s) => s.runs)
  const conversation = useStore((s) => s.conversation)
  const currentRun = useStore((s) => s.currentRun)
  const storeSel = useStore((s) => s.selectedTraceItem)
  const enabledTools = useStore((s) => s.enabledTools)
  const [picked, setPicked] = useState<string | null>(null)
  const [replay, setReplayState] = useState<ReplayState | null>(null)

  const selectedRunId = storeSel?.runId ?? null
  const runs = useMemo(
    () => listRuns({ allRuns, conversationRunIds: conversation.map((i) => i.runId), currentRun, selectedRunId }),
    [allRuns, conversation, currentRun, selectedRunId],
  )

  // A new conversation forgets the run picked in the previous one.
  const conversationId = useStore((s) => s.conversationId)
  useEffect(() => setPicked(null), [conversationId])

  // A new run is followed at once; a step selected elsewhere (the chat) shows its run.
  useEffect(() => {
    if (currentRun) setPicked(currentRun)
  }, [currentRun])
  useEffect(() => {
    if (storeSel?.runId) setPicked(storeSel.runId)
  }, [storeSel?.runId])

  const run = pickShownRun(runs, picked, currentRun)
  const live = !!run && run.id === currentRun
  const activeReplay = replay && run && replay.runId === run.id && !live ? replay : null

  // A replay ends when another run is shown.
  useEffect(() => {
    if (replay && (!run || replay.runId !== run.id || live)) setReplayState(null)
  }, [replay, run, live])

  const events = run?.events
  const visible = useMemo(() => (events ? (activeReplay ? events.slice(0, activeReplay.pos) : events) : []), [events, activeReplay])
  const trace = useMemo(() => deriveTrace(visible, enabledTools), [visible, enabledTools])

  // The replay timer: one recorded event per tick, nothing else is called.
  useEffect(() => {
    if (!activeReplay?.playing || !events) return
    if (activeReplay.pos >= events.length) {
      setReplayState((r) => (r ? { ...r, playing: false } : r))
      return
    }
    const id = window.setTimeout(() => setReplayState((r) => (r ? { ...r, pos: Math.min(r.pos + 1, events.length) } : r)), REPLAY_STEP_MS / activeReplay.speed)
    return () => window.clearTimeout(id)
  }, [activeReplay, events])

  // When the followed live run ends, its final row stays selected instead of the selection vanishing.
  const liveRunId = live ? run!.id : null
  const wasLive = useRef<string | null>(null)
  useEffect(() => {
    const ended = wasLive.current
    wasLive.current = liveRunId
    if (!ended || liveRunId || run?.id !== ended) return
    const sel = getState().selectedTraceItem
    if (!sel || sel.runId !== ended) selectTraceItem({ runId: ended, itemId: 'final' })
  }, [liveRunId, run?.id])

  const own = storeSel && run && storeSel.runId === run.id ? storeSel.itemId : null
  const ownValid = own && (own.startsWith('node:') || trace.items.some((i) => i.id === own)) ? own : null
  const followsNewest = live || !!activeReplay
  const following = followsNewest && !ownValid
  const selected = ownValid ?? (followsNewest ? (trace.items.at(-1)?.id ?? null) : null)

  return {
    runs,
    run,
    live,
    trace,
    selected,
    following,
    pinned: live && !!ownValid,
    replay: activeReplay,
    pickRun: (id) => {
      setPicked(id)
      selectTraceItem(null)
    },
    select: (itemId) => selectTraceItem(run && itemId ? { runId: run.id, itemId } : null),
    startReplay: () => {
      if (!run || live || !run.events.length) return
      selectTraceItem(null)
      setReplayState({ runId: run.id, pos: 1, playing: true, speed: 1 })
    },
    setReplay: (patch) => setReplayState((r) => (r ? { ...r, ...patch } : r)),
    stepReplay: (delta) =>
      setReplayState((r) => (r && events ? { ...r, playing: false, pos: Math.max(1, Math.min(events.length, r.pos + delta)) } : r)),
    stopReplay: () => setReplayState(null),
  }
}
