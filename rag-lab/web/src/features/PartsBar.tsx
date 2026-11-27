import { cn } from '@/lib/utils'
import { useStore } from '@/state/store'
import { PARTS, goTo, partMark } from '@/state/nav'
import { useT } from '@/i18n'

/** The five parts in a row; the active one solid yellow. Scrolls sideways on narrow screens. */
export function PartsBar() {
  const current = useStore((s) => s.ui.part)
  // Serialise in the selector so the snapshot is a stable primitive.
  const marks = useStore((s) => PARTS.map((p) => partMark(p, s) ?? '').join('|')).split('|')
  const tx = useT().shell
  return (
    <nav aria-label={tx.partsAria} className="scroll-thin flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 sm:px-4" data-testid="parts-bar">
      {PARTS.map((id, i) => {
        const active = id === current
        const mark = marks[i]
        return (
          <button
            key={id}
            onClick={() => goTo(id)}
            aria-current={active ? 'page' : undefined}
            data-testid={`nav-${id}`}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] transition-colors cursor-pointer',
              active ? 'bg-primary font-semibold text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted',
            )}
          >
            <span className="font-mono text-[11.5px] font-semibold">{i + 1}</span>
            <span>{tx.parts[id]}</span>
            {mark !== '' && (
              <span className={cn('rounded-full px-1.5 py-px font-mono text-[10.5px] tabular-nums', active ? 'bg-card text-foreground' : 'bg-subtle text-foreground')} data-testid={`mark-${id}`}>
                {mark}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
