import { setUi, useStore } from '@/state/store'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/** Header switch between the Rybex case and the team's own documents. */
export function ModeSwitch() {
  const mode = useStore((s) => s.ui.mode)
  const tx = useT().shell.own
  const item = (m: 'rybex' | 'own', label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => setUi({ mode: m })}
      className={cn('cursor-pointer whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors', mode === m ? 'bg-foreground text-background' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label={tx.switchAria} className="flex shrink-0 items-center gap-0.5 rounded-full bg-subtle p-[3px]" data-testid="mode-switch" data-mode={mode}>
      {item('rybex', tx.rybex)}
      {item('own', tx.mine)}
    </div>
  )
}
