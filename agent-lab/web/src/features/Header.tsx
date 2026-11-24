import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/state/store'
import { showActivation } from '@/state/actions'
import { useT } from '@/i18n'
import { Logo } from './Logo'
import { LangSwitch } from './LangSwitch'
import { DemoBadge, KbStatus, LogoutButton, QuotaMeter, ResetMenu, SimDate, StatusButton } from './HeaderControls'
import { LearnButton } from './learn/LearnButton'

/** edulab top menu: solid white full-bleed bar, ink mark + wordmark, then the app name. */
export function Header() {
  const status = useStore((s) => s.auth.status)
  const tx = useT().shell.header
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2.5 border-b bg-card pl-1.5 pr-3 sm:gap-3 sm:pl-3 sm:pr-5">
      <div className="flex shrink-0 items-center">
        <Logo className="size-14 sm:size-[60px]" />
        <span className="hidden font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-foreground sm:inline">edulab</span>
      </div>
      <span aria-hidden="true" className="hidden h-9 w-px shrink-0 bg-border sm:block" />
      <div className="min-w-0">
        <div className="truncate font-display text-[16px] font-bold leading-tight tracking-[-0.01em] sm:text-[18px]">{tx.product}</div>
        <div className="hidden truncate text-[12.5px] leading-tight text-[var(--ink-2)] 2xl:block">{tx.tagline}</div>
        <DemoBadge short />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <SimDate />
        <KbStatus />
        <DemoBadge />
        <QuotaMeter />
        <StatusButton />
        {status !== 'active' && (
          <Button size="sm" variant="accent" onClick={showActivation}>
            <KeyRound /> {tx.activate}
          </Button>
        )}
        <LearnButton />
        <ResetMenu />
        <LangSwitch />
        {status === 'active' && <LogoutButton />}
      </div>
    </header>
  )
}
