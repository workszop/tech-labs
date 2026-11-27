import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { setSettings, setUi, useStore } from '@/state/store'
import { useT } from '@/i18n'
import { SEG, segItem } from '../common'

/** Vector database, Tech: display options of the vector map, right above it. */
export function MapOptions() {
  const s = useStore((st) => st.settings)
  const tx = useT().lab.vectors.mapOptions
  const mapTx = useT().lab.map
  const label = 'font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground'
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-card px-4 py-2.5 text-[12.5px]" data-testid="map-options" aria-label={tx.title} role="group">
      <span className="flex items-center gap-2">
        <span className={label}>{tx.mapMode}</span>
        <span className={SEG}>
          {(['question', '2d', '3d'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={s.vizMode === m} className={segItem(s.vizMode === m)} onClick={() => setSettings({ vizMode: m })}>
              {m === 'question' ? mapTx.viewQuestion : m.toUpperCase()}
            </button>
          ))}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className={label}>{tx.colorBy}</span>
        <span className={SEG}>
          {(['folder', 'document'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={s.colorBy === m} className={segItem(s.colorBy === m)} onClick={() => setSettings({ colorBy: m })}>
              {m === 'folder' ? tx.colorByFolder : tx.colorByDocument}
            </button>
          ))}
        </span>
      </span>
      <label className="flex items-center gap-2">
        <Switch checked={s.showConnections} onCheckedChange={(v) => setSettings({ showConnections: v })} /> {tx.connections}
      </label>
      <label className="flex items-center gap-2">
        <Switch checked={s.showLabels} onCheckedChange={(v) => setSettings({ showLabels: v })} /> {tx.labels}
      </label>
      <Button
        size="xs"
        variant="outline"
        className="ml-auto"
        title={tx.reset}
        onClick={() => {
          setSettings({ vizMode: 'question', colorBy: 'folder', showConnections: true, showLabels: false })
          setUi({ mapFocusDoc: null, mapFolders: null })
        }}
      >
        <RotateCcw /> {tx.resetButton}
      </Button>
    </div>
  )
}
