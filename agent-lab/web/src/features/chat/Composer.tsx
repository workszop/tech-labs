/** Message box: Enter sends, Shift+Enter adds a line; Stop replaces Send while a run is active. */
import { forwardRef, useLayoutEffect, useRef, useImperativeHandle } from 'react'
import { AlertTriangle, Info, KeyRound, LoaderCircle, RotateCcw, SendHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/**
 * Why the composer cannot send now. `running` / `awaiting` keep the box focusable
 * (read-only), so the focus stays in it after sending. `kbFailed` does not block:
 * the agent can still answer, only the document search reports that the index is
 * not ready, so the line explains it and offers Retry.
 */
export type BlockReason =
  | { kind: 'inactive' }
  | { kind: 'storage' }
  | { kind: 'loading' }
  | { kind: 'kbFailed' }
  | { kind: 'kbChecking' }
  | { kind: 'kbIndexing'; done: number; total: number }
  | { kind: 'running' }
  | { kind: 'awaiting' }

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onActivate: () => void
  onRetryKb: () => void
  block: BlockReason | null
  running: boolean
  max: number
  error: string | null
}

export const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer({ value, onChange, onSend, onStop, onActivate, onRetryKb, block: shown, running, max, error }, outer) {
  const tx = useT().chat.composer
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(outer, () => ref.current!, [])
  const block = shown?.kind === 'kbFailed' ? null : shown
  const hard = block !== null && block.kind !== 'running' && block.kind !== 'awaiting'
  const canSend = block === null && value.trim().length > 0

  // Grow with the text up to about six lines.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }, [value])

  const reason = shown && {
    inactive: tx.reasons.inactive,
    storage: tx.reasons.storage,
    loading: tx.reasons.loading,
    kbFailed: tx.reasons.kbFailed,
    kbChecking: tx.reasons.kbChecking,
    kbIndexing: shown.kind === 'kbIndexing' ? tx.reasons.kbIndexing(shown.done, shown.total) : '',
    running: tx.reasons.running,
    awaiting: tx.reasons.awaiting,
  }[shown.kind]
  const reasonId = 'chat-composer-reason'
  const near = value.length >= max * 0.8

  return (
    <div className="shrink-0 border-t border-hairline bg-subtle px-3 pb-3 pt-2" data-testid="composer">
      {reason && (
        <p id={reasonId} className={cn('mb-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-[var(--ink-2)]', (shown?.kind === 'kbFailed' || shown?.kind === 'storage') && 'text-danger')} data-testid="composer-reason" data-reason={shown?.kind}>
          {shown?.kind === 'kbIndexing' || shown?.kind === 'kbChecking' || shown?.kind === 'loading' ? (
            <LoaderCircle className="mt-px size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : shown?.kind === 'kbFailed' || shown?.kind === 'storage' ? (
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">{reason}</span>
          {shown?.kind === 'inactive' && (
            <Button size="xs" onClick={onActivate} className="-my-0.5 shrink-0">
              <KeyRound /> {tx.activate}
            </Button>
          )}
          {shown?.kind === 'kbFailed' && (
            <Button size="xs" variant="outline" onClick={onRetryKb} className="-my-0.5 shrink-0" data-testid="composer-kb-retry">
              <RotateCcw /> {tx.retryKb}
            </Button>
          )}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={max}
          disabled={hard}
          readOnly={!hard && block !== null}
          aria-disabled={block !== null || undefined}
          aria-label={tx.label}
          aria-describedby={reason ? reasonId : undefined}
          placeholder={tx.placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // keyCode 229: Safari fires this keydown right after compositionend with isComposing=false.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
          className={cn('scroll-thin max-h-[150px] min-h-[40px] min-w-0 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-[14px] leading-snug text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-subtle read-only:cursor-default', hard && 'text-muted-foreground')}
          data-testid="composer-input"
        />
        {running ? (
          <Button variant="outline" onClick={onStop} className="h-10 shrink-0" data-testid="composer-stop">
            <Square fill="currentColor" /> {tx.stop}
          </Button>
        ) : (
          <Button onClick={onSend} disabled={!canSend} className="h-10 shrink-0" data-testid="composer-send">
            <SendHorizontal /> {tx.send}
          </Button>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1 font-mono text-[10.5px] text-muted-foreground">
        <span className="max-[420px]:hidden">{tx.keys}</span>
        {near && <span className="ml-auto" aria-live="polite">{tx.counter(value.length, max)}</span>}
      </div>
      {error && <p role="alert" className="mt-1 px-1 text-[12px] font-medium text-danger">{error}</p>}
    </div>
  )
})
