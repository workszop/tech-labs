/** The nine scenario cards: title, what the scenario teaches, and the customer it signs in as. */
import { Coffee, KeyRound, Megaphone, PackageSearch, Repeat2, ShieldCheck, Wind, Wrench, HelpCircle, UserRoundCheck, type LucideIcon } from 'lucide-react'
import type { Customer } from '@/data/company/types'
import { SCENARIOS, type Scenario } from '@/data/scenarios'
import { useLang, useT } from '@/i18n'
import { IconBadge } from '../common'

const ICON: Record<string, LucideIcon> = {
  'product-failure-e04': Coffee,
  'delayed-shipment': PackageSearch,
  'warranty-question': ShieldCheck,
  'repeated-failure': Repeat2,
  'troubleshooting-s2': Wind,
  'complaint-overdue-repair': Megaphone,
  'multiple-products': HelpCircle,
  'paid-repair-ticket': Wrench,
  'access-control': KeyRound,
}

export function ScenarioList({ customers, onPick }: { customers: Customer[]; onPick: (s: Scenario) => void }) {
  const tx = useT().chat.scenarios
  const lang = useLang()
  return (
    <ul className="grid gap-2.5 @lg:grid-cols-2" data-testid="scenario-list">
      {SCENARIOS.map((s) => {
        const Icon = ICON[s.id] ?? HelpCircle
        const customer = customers.find((c) => c.id === s.customerId)
        return (
          <li key={s.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onPick(s)}
              aria-label={tx.pick(s.title[lang])}
              className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-colors hover:border-[var(--line-strong)]"
              data-scenario={s.id}
            >
              <span className="flex items-center gap-2.5 border-b border-hairline bg-subtle px-3 py-2 transition-colors group-hover:bg-muted">
                <IconBadge size="sm"><Icon /></IconBadge>
                <span className="min-w-0 font-display text-[14px] font-bold leading-snug text-foreground">{s.title[lang]}</span>
              </span>
              <span className="flex-1 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                <span className="mb-0.5 block font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.teaches}</span>
                {s.teaches[lang]}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 border-t border-dashed border-border px-3 py-1.5 text-[12px] text-[var(--ink-2)]">
                <UserRoundCheck className="size-3.5 shrink-0 text-foreground" aria-hidden="true" />
                <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.signsInAs}</span>
                <span className="min-w-0 truncate font-semibold text-foreground">{customer?.name ?? s.customerId}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{s.customerId}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
