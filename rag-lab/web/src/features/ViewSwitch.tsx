import { setSettings, useStore, type View } from '@/state/store'
import { useT } from '@/i18n'
import { SEG, segItem } from './common'

const VIEWS: View[] = ['students', 'tech']

/** Students / Tech switch. The app never flips it on its own; only this click does. */
export function ViewSwitch() {
  const view = useStore((s) => s.settings.view)
  const tx = useT().shell.view
  return (
    <div role="radiogroup" aria-label={tx.aria} className={`${SEG} shrink-0`} data-testid="view-switch">
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          className={segItem(view === v)}
          onClick={() => setSettings({ view: v })}
          data-testid={`view-${v}`}
        >
          {tx[v]}
        </button>
      ))}
    </div>
  )
}
