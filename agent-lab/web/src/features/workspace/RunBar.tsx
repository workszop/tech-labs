/** Run selector above the graph, and the replay controls for a finished run. */
import { ChevronLeft, ChevronRight, Crosshair, History, Pause, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn, currentLocale } from '@/lib/utils'
import { useT } from '@/i18n'
import { REPLAY_SPEEDS, type RunView } from './useRunView'

function timeOf(ms: number): string {
  return new Intl.DateTimeFormat(currentLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ms)
}

function short(text: string, n = 48): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

export function RunBar({ view }: { view: RunView }) {
  const tx = useT().flow
  const { runs, run, live, replay } = view
  if (!run) return null
  const canReplay = !live && run.events.length > 0 && !replay
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{tx.runs.label}</span>
        <select
          value={run.id}
          onChange={(e) => view.pickRun(e.target.value)}
          className="h-8 min-w-0 flex-1 cursor-pointer truncate rounded-full border border-input bg-card px-3 text-[12.5px] text-foreground"
          data-testid="run-select"
        >
          {runs.map((r, i) => {
            const state = r.outcome ? tx.runs.outcome[r.outcome] : tx.runs.live
            return (
              <option key={r.id} value={r.id}>
                {tx.runs.option(i + 1, timeOf(r.startedAt), short(r.message))} · {state}
              </option>
            )
          })}
        </select>
      </label>
      {view.pinned && (
        <Button size="xs" variant="outline" onClick={() => view.select(null)}>
          <Crosshair />
          {tx.runs.followLive}
        </Button>
      )}
      {canReplay && (
        <Tooltip content={tx.replay.startHint}>
          <Button size="xs" variant="outline" onClick={view.startReplay} data-testid="replay-start">
            <History />
            {tx.replay.start}
          </Button>
        </Tooltip>
      )}
    </div>
  )
}

/** Shown while a replay runs: what it is, and play / pause / step / speed / end. */
export function ReplayBar({ view }: { view: RunView }) {
  const tx = useT().flow.replay
  const { replay, run } = view
  if (!replay || !run) return null
  const total = run.events.length
  const atEnd = replay.pos >= total
  return (
    <div className="border-b border-hairline" data-testid="replay-bar">
      <div className="edu-block flex items-center gap-2 bg-primary px-3 py-1.5 text-[12.5px] font-semibold leading-snug text-primary-foreground" role="status">
        <History aria-hidden="true" className="size-4 shrink-0" />
        <span>{tx.banner}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 bg-subtle px-3 py-1.5">
        <Button size="icon-sm" variant="outline" onClick={() => view.stepReplay(-1)} disabled={replay.pos <= 1} aria-label={tx.back}><ChevronLeft /></Button>
        {replay.playing ? (
          <Button size="xs" onClick={() => view.setReplay({ playing: false })}><Pause />{tx.pause}</Button>
        ) : (
          <Button size="xs" onClick={() => view.setReplay({ playing: true, ...(atEnd ? { pos: 1 } : {}) })}><Play />{tx.play}</Button>
        )}
        <Button size="icon-sm" variant="outline" onClick={() => view.stepReplay(1)} disabled={atEnd} aria-label={tx.step}><ChevronRight /></Button>
        <div role="group" aria-label={tx.speed} className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
          {REPLAY_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => view.setReplay({ speed: s })}
              aria-pressed={replay.speed === s}
              className={cn('h-6 cursor-pointer rounded-full px-2 font-mono text-[11px] transition-colors', replay.speed === s ? 'bg-primary font-semibold text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-card')}
            >
              {s.toLocaleString(document.documentElement.lang || undefined)}×
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-2)]" aria-live="polite" data-testid="replay-progress">{tx.progress(replay.pos, total)}</span>
        <Button size="xs" variant="ghost" className="ml-auto" onClick={view.stopReplay}><X />{tx.exit}</Button>
      </div>
    </div>
  )
}
