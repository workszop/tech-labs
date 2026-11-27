import { Gauge, GraduationCap, KeyRound, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { setUi, useStore } from '@/state/store'
import { goTo } from '@/state/nav'
import { showActivation } from '@/state/actions'
import { useT } from '@/i18n'
import { Logo } from './Logo'
import { LangSwitch } from './LangSwitch'
import { ViewSwitch } from './ViewSwitch'
import { fmtNumber, fmtUsd } from './common'

/** edulab top menu, adapted to the workbench: solid white full-bleed bar, ink mark + wordmark, then the app name. */
export function Header() {
  const usage = useStore((s) => s.usage)
  const status = useStore((s) => s.auth.status)
  const provider = useStore((s) => s.auth.session?.capabilities.provider)
  const tx = useT().shell.header
  const pct = usage ? Math.min(100, (usage.tokensUsed / Math.max(1, usage.tokenLimit)) * 100) : 0
  const tokensLeft = usage ? usage.tokenLimit - usage.tokensUsed : 0
  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2.5 border-b bg-card pl-1.5 pr-3 sm:gap-3 sm:pl-3 sm:pr-5">
      <div className="flex shrink-0 items-center">
        <Logo className="size-14 sm:size-[60px]" />
        <span className="hidden font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-foreground sm:inline">edulab</span>
      </div>
      <span aria-hidden="true" className="hidden h-9 w-px shrink-0 bg-border sm:block" />
      <div className="min-w-0">
        <div className="truncate font-display text-[18px] font-bold leading-tight tracking-[-0.01em]">{tx.product}</div>
        <div className="hidden truncate text-[12.5px] leading-tight text-[var(--ink-2)] md:block">{tx.tagline}</div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {provider === 'mock' && (
          <Tooltip content={tx.mockTooltip}>
            <span className="hidden min-[480px]:inline-flex"><Badge variant="warn">{tx.mockBadge}</Badge></span>
          </Tooltip>
        )}
        {usage && (
          <Tooltip
            content={tx.usageTooltip({
              requestsUsed: fmtNumber(usage.requestsUsed),
              requestLimit: fmtNumber(usage.requestLimit),
              tokensUsed: fmtNumber(usage.tokensUsed),
              tokenLimit: fmtNumber(usage.tokenLimit),
              cost: fmtUsd(usage.estimatedCostUsd),
            })}
          >
            <button className="hidden items-center gap-2 rounded-full px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ink-2)] transition-colors hover:bg-muted lg:flex cursor-pointer" onClick={() => setUi({ settingsOpen: true })} data-testid="usage-meter">
              <Gauge className="size-3.5" />
              <span className="block h-2 w-20 overflow-hidden rounded-full bg-foreground">
                <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
              </span>
              <span className={cn('tabular-nums', pct > 85 && 'font-medium text-danger')}>{tx.tokensLeft(fmtNumber(tokensLeft), Math.round(tokensLeft))}</span>
            </button>
          </Tooltip>
        )}
        {status !== 'active' && (
          <Button size="sm" variant="accent" onClick={showActivation}>
            <KeyRound /> {tx.activate}
          </Button>
        )}
        <LangSwitch />
        <ViewSwitch />
        <div className="flex items-center">
          <Tooltip content={tx.guideTooltip}>
            <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => goTo('case')} aria-label={tx.guideAria}>
              <GraduationCap />
            </Button>
          </Tooltip>
          <Tooltip content={tx.settingsTooltip}>
            <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => setUi({ settingsOpen: true })} aria-label={tx.settingsAria}>
              <Settings />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
