import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { LANGS, useLang, useT, type Lang } from '@/i18n'
import { langSwitchLosesWork, setLang } from '@/state/actions'

/** PL / EN switch. Asks first when switching would clear an index or a conversation. */
export function LangSwitch() {
  const lang = useLang()
  const t = useT().shell.langSwitch
  const [pending, setPending] = useState<Lang | null>(null)
  const choose = (l: Lang) => {
    if (l === lang) return
    if (langSwitchLosesWork()) setPending(l)
    else void setLang(l)
  }
  return (
    <>
      <div role="group" aria-label={t.label} className="flex shrink-0 items-center gap-0.5 rounded-full bg-subtle p-[3px]" data-testid="lang-switch">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => choose(l)}
            aria-pressed={l === lang}
            lang={l}
            className={cn('cursor-pointer rounded-full px-2 py-1 text-[12px] sm:px-2.5 font-semibold uppercase tracking-wide transition-colors', l === lang ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')}
          >
            {l}
          </button>
        ))}
      </div>
      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-[var(--ink-2)]">{t.confirmBody}</p>
          </DialogBody>
          <div className="flex justify-end gap-2 border-t border-dashed px-5 py-3">
            <Button variant="outline" onClick={() => setPending(null)}>{t.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                const l = pending
                setPending(null)
                if (l) void setLang(l)
              }}
            >
              {t.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
