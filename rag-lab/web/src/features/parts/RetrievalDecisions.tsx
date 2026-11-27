import { ListOrdered } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { setSettings, useStore } from '@/state/store'
import { useT } from '@/i18n'
import { Explain, SectionCard } from '../common'

/** Vector database, Students: how many fragments answer a question (top-k) and the minimum similarity (threshold). */
export function RetrievalDecisions() {
  const topK = useStore((s) => s.settings.topK)
  const threshold = useStore((s) => s.settings.threshold)
  const tx = useT().lab.vectors
  return (
    <SectionCard icon={<ListOrdered />} title={tx.retrievalTitle} explain="topk" data-testid="retrieval-decisions">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.topK} <Explain topic="topk" /></span>
            <span className="font-mono text-xs">{topK}</span>
          </div>
          <Slider min={1} max={10} step={1} value={[topK]} onValueChange={([v]) => setSettings({ topK: v })} aria-label={tx.topK} />
          <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.topKHint}</div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.threshold} <Explain topic="cosine" /></span>
            <span className="font-mono text-xs">{threshold !== null ? threshold.toFixed(2) : '–'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={threshold !== null} onCheckedChange={(v) => setSettings({ threshold: v ? 0.3 : null })} aria-label={tx.thresholdEnableAria} />
            {threshold !== null && <Slider min={0} max={0.9} step={0.01} value={[threshold]} onValueChange={([v]) => setSettings({ threshold: v })} aria-label={tx.thresholdAria} />}
          </div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.thresholdHint}</div>
        </div>
      </div>
    </SectionCard>
  )
}
