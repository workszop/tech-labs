import { useState } from 'react'
import { BookText, Building2, Contact, Info, ShoppingBag, Truck, type LucideIcon } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { IconBadge } from '../common'
import { ChatIdentity } from './ChatIdentity'
import { ExplorerView, type ViewState } from './ExplorerView'
import { GROUPS, type GroupId, type ViewId } from './model'
import { useExplorerData } from './ui'
import { useShowHandler } from '../learn/bus'

export const GROUP_ICON: Record<GroupId, LucideIcon> = { sales: ShoppingBag, logistics: Truck, crm: Contact, knowledge: BookText }

/** Left panel: the company systems the agent can reach, as four groups of browsable tables. */
export function SystemsPanel() {
  const tx = useT().systems
  const { data, loaded } = useExplorerData()
  const [group, setGroup] = useState<GroupId>('sales')
  const [viewOf, setViewOf] = useState<Record<GroupId, ViewId>>({ sales: 'customers', logistics: 'shipments', crm: 'profiles', knowledge: 'documents' })
  const [states, setStates] = useState<Partial<Record<ViewId, ViewState>>>({})
  // "Show me" from the Learn dialog: open the requested group (CRM, knowledge base).
  useShowHandler((target) => {
    if (target.kind === 'systems') setGroup(target.group)
  })
  const view = viewOf[group]
  const views = GROUPS.find((g) => g.id === group)!.views

  return (
    <section data-panel="systems" aria-label={tx.panel.title} className="@container flex h-full min-h-0 flex-col bg-card">
      <div className="border-b border-hairline bg-subtle px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-2.5 max-[1099px]:hidden">
          <IconBadge tone="doc"><Building2 /></IconBadge>
          <div className="min-w-0">
            <h2 className="truncate font-display text-[15px] font-bold leading-tight">{tx.panel.title}</h2>
            <div className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{tx.panel.subtitle}</div>
          </div>
        </div>
        <nav aria-label={tx.panel.groupsLabel} className="mt-2.5 grid grid-cols-2 gap-1.5 max-[1099px]:mt-0 @2xl:grid-cols-4">
          {GROUPS.map((g) => {
            const Icon = GROUP_ICON[g.id]
            const on = g.id === group
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                aria-current={on ? 'true' : undefined}
                className={cn('flex min-h-9 min-w-0 cursor-pointer items-center gap-2 rounded-2xl py-1 pl-3 pr-2.5 @sm:rounded-full @sm:pl-1 text-left text-[12.5px] font-semibold leading-tight transition-colors', on ? 'bg-primary text-primary-foreground' : 'bg-card text-[var(--ink-2)] hover:bg-muted hover:text-foreground')}
                data-group={g.id}
              >
                <span aria-hidden="true" className="hidden size-7 shrink-0 place-items-center rounded-full bg-doc text-[var(--blue-ink)] @sm:inline-grid [&_svg]:size-4"><Icon /></span>
                <span className="min-w-0 @sm:truncate">{tx.groups[g.id]}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {views.length > 1 && (
        <nav aria-label={tx.panel.viewsLabel} className="flex flex-wrap gap-1 border-b border-hairline px-3 py-2">
          {views.map((v) => {
            const on = v === view
            return (
              <button
                key={v}
                type="button"
                onClick={() => setViewOf({ ...viewOf, [group]: v })}
                aria-current={on ? 'true' : undefined}
                className={cn('h-7 cursor-pointer whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors', on ? 'bg-foreground text-background' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')}
                data-view-tab={v}
              >
                {tx.views[v]}
              </button>
            )
          })}
        </nav>
      )}
      <p className="border-b border-hairline px-3 py-1.5 text-[12px] leading-snug text-[var(--ink-2)]">
        {views.length === 1 && <b className="mr-1 font-semibold text-foreground">{tx.views[view]}:</b>}
        {tx.viewHints[view]}
      </p>

      {view === 'customers' && loaded && <ChatIdentity customers={data.customers} />}

      <ExplorerView
        key={view}
        view={view}
        data={data}
        loaded={loaded}
        state={states[view] ?? { query: '', filters: {} }}
        onChange={(s) => setStates((prev) => ({ ...prev, [view]: s }))}
      />

      <Tooltip content={tx.panel.noticeTooltip} side="top">
        <p className="flex shrink-0 cursor-help items-center gap-1.5 border-t border-hairline bg-subtle px-3 py-1.5 text-[11.5px] leading-snug text-[var(--ink-2)]" data-testid="sim-notice">
          <Info aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0">{tx.panel.notice}</span>
          <span className="sr-only"> {tx.panel.noticeTooltip}</span>
        </p>
      </Tooltip>
    </section>
  )
}
