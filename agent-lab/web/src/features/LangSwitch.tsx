import { cn } from '@/lib/utils'
import { LANGS, useLang, useT } from '@/i18n'
import { setLang } from '@/state/actions'

/** PL / EN switch. Later tasks ask for confirmation here when switching would clear work. */
export function LangSwitch() {
  const lang = useLang()
  const t = useT().shell.langSwitch
  return (
    <div role="group" aria-label={t.label} className="flex shrink-0 items-center gap-0.5 rounded-full bg-subtle p-[3px]" data-testid="lang-switch">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
          lang={l}
          className={cn('cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide transition-colors', l === lang ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
