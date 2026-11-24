import { Fragment, useMemo } from 'react'
import { SearchX, Search, Ticket, UserRoundCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useLang, useT } from '@/i18n'
import { useStore } from '@/state/store'
import { EmptyState } from '../common'
import { COLUMNS, type CellCtx, type Column } from './columns'
import { VIEWS, viewRows, type ExplorerData, type FilterSpec, type ViewId } from './model'
import { openRecord } from './recordNav'
import { ActiveMark } from './ui'
import type { KbDocument } from '@/data/kb/types'

export interface ViewState {
  query: string
  filters: Record<string, string>
}

const SHOW: Record<NonNullable<Column<unknown>['show']>, string> = {
  always: '',
  md: 'hidden @lg:table-cell',
  lg: 'hidden @3xl:table-cell',
}

/** One explorer view: search, filters, count and the ruled table. Rows open the record dialog. */
export function ExplorerView({ view, data, loaded, state, onChange }: { view: ViewId; data: ExplorerData; loaded: boolean; state: ViewState; onChange: (s: ViewState) => void }) {
  const tx = useT().systems
  const lang = useLang()
  const activeCustomerId = useStore((s) => s.activeCustomerId)
  const spec = VIEWS[view]
  const cols = COLUMNS[view]
  const total = useMemo(() => spec.rows(data).length, [spec, data])
  const rows = useMemo(() => viewRows(view, data, { lang, query: state.query, filters: state.filters, activeCustomerId }), [view, data, lang, state, activeCustomerId])
  const ctx: CellCtx = { tx, lang, data }
  const dirty = state.query.trim() !== '' || spec.filters.some((f: FilterSpec<unknown>) => (state.filters[f.key] ?? f.default) !== f.default)
  const setFilter = (key: string, value: string) => onChange({ ...state, filters: { ...state.filters, [key]: value } })
  const searchId = `search-${view}`

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-view={view}>
      <div className="space-y-2 border-b border-hairline px-3 py-2.5">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">{tx.search.label}</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id={searchId}
            type="search"
            value={state.query}
            onChange={(e) => onChange({ ...state, query: e.target.value })}
            placeholder={tx.search.placeholder}
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-8 text-[13.5px] text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            data-testid="explorer-search"
          />
          {state.query && (
            <button type="button" onClick={() => onChange({ ...state, query: '' })} className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-foreground hover:bg-muted" aria-label={tx.search.clear}>
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {spec.filters.map((f: FilterSpec<unknown>) => {
            const value = state.filters[f.key] ?? f.default
            if (f.toggle) {
              const on = value === 'yes'
              return (
                <Tooltip key={f.key} content={tx.filters.mineTooltip}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(f.key, on ? 'all' : 'yes')}
                    className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors [&_svg]:size-3.5', on ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-[var(--ink-2)] hover:bg-subtle')}
                    data-filter={f.key}
                  >
                    <UserRoundCheck aria-hidden="true" /> {tx.filters.mine}
                  </button>
                </Tooltip>
              )
            }
            const label = tx.filters.labels[f.key] ?? f.key
            return (
              <label key={f.key} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card pl-2.5 text-[12.5px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground">{label}</span>
                <select value={value} onChange={(e) => setFilter(f.key, e.target.value)} className="h-full max-w-40 cursor-pointer truncate rounded-r-md bg-transparent pr-1.5 text-[12.5px] font-medium text-foreground outline-none" data-filter={f.key}>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{optionLabel(tx, view, f.key, o)}</option>
                  ))}
                </select>
              </label>
            )
          })}
          <span className="ml-auto whitespace-nowrap pl-1 font-mono text-[11px] text-muted-foreground" aria-live="polite" data-testid="explorer-count">{loaded ? tx.count(rows.length, total) : tx.loading}</span>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        {!loaded ? null : rows.length === 0 ? (
          view === 'tickets' && total === 0 ? (
            <EmptyState icon={<Ticket />} tone="doc" title={tx.emptyTickets.title}>{tx.emptyTickets.body}</EmptyState>
          ) : (
            <div className="h-auto">
              <EmptyState icon={<SearchX />} tone="stone" title={tx.empty.title} action={dirty && <Button size="sm" variant="outline" onClick={() => onChange({ query: '', filters: {} })}>{tx.empty.reset}</Button>}>
                {tx.empty.body}
              </EmptyState>
            </div>
          )
        ) : (
          <table className="w-full border-collapse text-[13px]" data-testid="explorer-table">
            <thead className="sticky top-0 z-[1]">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={cn('whitespace-nowrap border-b border-border bg-muted px-2.5 py-1.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground', SHOW[c.show ?? 'always'], c.align === 'right' && 'text-right', c.grow && 'w-full')}>
                    {c.head(tx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const prevAuthority = view === 'documents' && i > 0 ? (rows[i - 1] as KbDocument).authority : null
                const authority = view === 'documents' ? (r as KbDocument).authority : null
                const mine = spec.owner(r) === activeCustomerId
                return (
                  <Fragment key={r.id}>
                    {authority && authority !== prevAuthority && (
                      <tr>
                        <th colSpan={cols.length} scope="colgroup" className="border-b border-hairline bg-subtle px-2.5 py-1.5 text-left">
                          <span className="font-display text-[13px] font-bold">{tx.enums.authority[authority]}</span>
                          <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{rows.filter((x) => (x as KbDocument).authority === authority).length}</span>
                        </th>
                      </tr>
                    )}
                    <tr
                      onClick={() => openRecord({ kind: spec.kind, id: r.id })}
                      className={cn('group cursor-pointer transition-colors hover:bg-[var(--line)]', i % 2 === 1 && 'bg-subtle')}
                      data-row={r.id}
                      data-mine={mine || undefined}
                    >
                      {cols.map((c, ci) => (
                        <td
                          key={c.key}
                          className={cn('border-b border-hairline px-2.5 py-1.5 align-middle', SHOW[c.show ?? 'always'], c.grow ? 'max-w-0' : 'whitespace-nowrap', c.align === 'right' && 'text-right tabular-nums', ci > 0 && !c.grow && 'text-[var(--ink-2)]')}
                          title={c.title?.(r, ctx)}
                        >
                          {c.key === 'id' ? (
                            <span className="flex items-center gap-1.5">
                              <button type="button" className="cursor-pointer rounded-[var(--r-xs)] font-mono text-[12px] font-semibold text-foreground underline-offset-2 group-hover:underline" onClick={(e) => (e.stopPropagation(), openRecord({ kind: spec.kind, id: r.id }))}>
                                {r.id}
                              </button>
                              {mine && <ActiveMark />}
                            </span>
                          ) : (
                            c.cell(r, ctx)
                          )}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function optionLabel(tx: ReturnType<typeof useT>['systems'], view: ViewId, key: string, o: string): string {
  if (o === 'all') return tx.filters.all
  const e = tx.enums
  switch (key) {
    case 'status':
      if (view === 'orders') return e.orderStatus[o] ?? o
      if (view === 'warranties') return e.warrantyStatus[o] ?? o
      if (view === 'cases') return o === 'unresolved' ? tx.filters.unresolved : (e.caseStatus[o] ?? o)
      if (view === 'documents') return e.docStatus[o] ?? o
      return e.shipmentStatus[o] ?? o
    case 'type':
      return view === 'interactions' ? (e.interactionType[o] ?? o) : (e.shipmentType[o] ?? o)
    case 'segment':
      return e.segment[o] ?? o
    case 'category':
      return e.category[o] ?? o
    case 'production':
      return o === 'current' ? tx.filters.current : tx.filters.discontinued
    case 'channel':
      return e.channel[o] ?? o
    case 'priority':
      return e.priority[o] ?? o
    case 'authority':
      return e.authority[o] ?? o
    case 'cases':
      return tx.filters.withOpenCases
    default:
      return o
  }
}
