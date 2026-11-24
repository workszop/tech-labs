/**
 * Small info button: one or two sentences in a popover and a "Learn more" link
 * that opens the matching topic of the Learn dialog. A real button with an
 * accessible name; the popover follows it in the DOM (so Tab reaches the link)
 * and is placed with fixed coordinates so panel edges never clip it.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { openLearn } from './bus'
import { TIP_TOPIC, type TipId } from './topics'

const WIDTH = 272
const MARGIN = 12

export function InfoTip({ tip, className }: { tip: TipId; className?: string }) {
  const tx = useT().learn.tips
  const t = tx[tip]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !button.current) return
    // Keep the focus on the button while the tip is open (Safari does not focus buttons on click), so Escape and Tab work from it.
    if (document.activeElement !== button.current) button.current.focus({ preventScroll: true })
    const r = button.current.getBoundingClientRect()
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN)
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - MARGIN))
    const h = pop.current?.offsetHeight ?? 120
    const above = r.bottom + 8 + h > window.innerHeight - MARGIN && r.top - 8 - h > MARGIN
    setPos({ left, top: above ? r.top - 8 - h : r.bottom + 8, above })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!pop.current?.contains(target) && !button.current?.contains(target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        button.current?.focus()
      }
    }
    const onFocus = (e: FocusEvent) => {
      const target = e.target as Node
      if (!pop.current?.contains(target) && !button.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocus)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t.label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cn(
          'inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5',
          open && 'bg-foreground text-[var(--yellow)] hover:bg-foreground hover:text-[var(--yellow)]',
          className,
        )}
        data-info-tip={tip}
      >
        <Info aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={pop}
          id={id}
          role="group"
          aria-label={t.label}
          style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(WIDTH, window.innerWidth - 2 * MARGIN) }}
          className="z-50 rounded-lg border border-border bg-card p-3 text-left font-sans text-[12.5px] font-normal normal-case leading-relaxed tracking-normal text-foreground shadow-md"
          data-info-pop={tip}
        >
          <p>{t.text}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              openLearn(TIP_TOPIC[tip])
            }}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-[var(--r-xs)] font-semibold text-doc underline-offset-2 hover:underline [&_svg]:size-3.5"
            data-learn-more={TIP_TOPIC[tip]}
          >
            {tx.learnMore} <ArrowRight aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  )
}
