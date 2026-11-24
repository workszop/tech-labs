/**
 * Experiment actions on a finished run in the workspace run bar: "Repeat this
 * question" (same message, same customer, current tool switches, new
 * conversation) and the comparison of two runs. Right after a repeat the
 * comparison with the repeated run is offered as the main action.
 */
import { useState } from 'react'
import { GitCompareArrows, Repeat2 } from 'lucide-react'
import type { RunRecord } from '@/agent/types'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useT } from '@/i18n'
import { repeatRun } from '@/state/actions'
import { useStore } from '@/state/store'
import { CompareDialog } from './CompareDialog'
import { defaultPartner } from './compare'

export function RunExperiments({ run, live }: { run: RunRecord; live: boolean }) {
  const tx = useT().learn
  const runs = useStore((s) => s.runs)
  const busy = useStore((s) => s.currentRun !== null)
  const active = useStore((s) => s.auth.status === 'active' && s.ready)
  const [pair, setPair] = useState<{ a: string | null; b: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const finished = !live && !!run.outcome
  const source = run.repeatOf ? runs.find((r) => r.id === run.repeatOf && r.outcome) : undefined
  const canCompare = finished && runs.filter((r) => r.outcome).length >= 2

  const openCompare = () => {
    const partner = defaultPartner(runs.filter((r) => r.outcome), run)
    setPair({ a: partner?.id ?? null, b: run.id })
  }

  return (
    <>
      {finished && (
        <Tooltip content={tx.repeat.hint}>
          <Button
            size="xs"
            variant="outline"
            disabled={busy || !active}
            onClick={() => {
              setError(null)
              repeatRun(run.id).catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : tx.repeat.failed))
            }}
            data-testid="repeat-run"
          >
            <Repeat2 />
            {tx.repeat.button}
          </Button>
        </Tooltip>
      )}
      {canCompare && (
        <Tooltip content={tx.compare.openHint}>
          <Button size="xs" variant={source ? 'default' : 'outline'} onClick={openCompare} data-testid={source ? 'compare-previous' : 'compare-open'}>
            <GitCompareArrows />
            {source ? tx.compare.openPrevious : tx.compare.open}
          </Button>
        </Tooltip>
      )}
      {error && <p role="alert" className="basis-full text-[12px] font-semibold text-danger">{error}</p>}
      <CompareDialog
        open={pair !== null}
        onOpenChange={(o) => !o && setPair(null)}
        a={pair?.a ?? null}
        b={pair?.b ?? null}
        onPick={(side, id) => setPair((p) => (p ? { ...p, [side]: id } : p))}
      />
    </>
  )
}
