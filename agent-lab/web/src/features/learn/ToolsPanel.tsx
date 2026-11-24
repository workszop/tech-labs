/**
 * Collapsible strip above the execution graph: the ten tool switches grouped by
 * system, and one-click presets for experiments. A switch changes the tools of
 * the next run only; while a run is in progress the switches are locked.
 */
import { useId, useState } from 'react'
import { ChevronDown, PenLine, Wrench } from 'lucide-react'
import { TOOL_NAMES, type SystemId, type ToolName } from '@shared/tools'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { setEnabledTools, setToolEnabled } from '@/state/actions'
import { useStore } from '@/state/store'
import { IconBadge } from '../common'
import { SYSTEM_ICON } from '../workspace/FlowGraph'
import { useShowHandler } from './bus'
import { InfoTip } from './InfoTip'
import { PRESET_IDS, disabledTools, presetOf, presetTools, toolsBySystem } from './presets'

/** The ten tools in the order of the graph's systems, each with its system. */
const TOOL_ROWS = toolsBySystem().flatMap(({ system, tools }) => tools.map((tool) => ({ system, tool })))

export function ToolsPanel() {
  const tx = useT()
  const t = tx.learn.tools
  const enabled = useStore((s) => s.enabledTools)
  const running = useStore((s) => s.currentRun !== null)
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const lockId = useId()
  const off = disabledTools(enabled)
  const preset = presetOf(enabled)
  const total = TOOL_NAMES.length

  useShowHandler((target) => {
    if (target.kind === 'tools') setOpen(true)
  })

  return (
    <section aria-label={t.title} className="shrink-0 border-b border-hairline bg-card" data-learn-spot="tools" data-testid="tools-panel">
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? t.toggleHide : t.toggleShow}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 text-left transition-colors hover:bg-subtle"
          data-testid="tools-toggle"
        >
          <IconBadge size="sm" className="size-6 [&_svg]:size-3.5"><Wrench /></IconBadge>
          <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-foreground">{t.title}</span>
          <span className="min-w-0 truncate text-[12px] text-[var(--ink-2)]" data-testid="tools-summary">
            {off.length === 0 ? t.summaryAll(total) : `${t.summary(total - off.length, total)} · ${t.off}: ${off.join(', ')}`}
          </span>
          <ChevronDown aria-hidden="true" className={cn('ml-auto size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        <InfoTip tip="tools" />
      </div>

      {open && (
        <div id={bodyId} className="@container scroll-thin max-h-[min(44vh,360px)] space-y-2 overflow-y-auto border-t border-hairline px-3 pb-2.5 pt-2" data-testid="tools-body">
          <p className="text-[12px] leading-snug text-[var(--ink-2)]">{t.note}</p>
          {running && (
            <p id={lockId} role="status" className="edu-block rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-primary-foreground" data-testid="tools-locked">
              {t.locked}
            </p>
          )}

          <div role="group" aria-label={t.presets} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{t.presets}</span>
            <div className="flex flex-wrap gap-0.5 rounded-2xl bg-subtle p-0.5">
              {PRESET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEnabledTools(presetTools(id))}
                  disabled={running}
                  aria-pressed={preset === id}
                  aria-describedby={running ? lockId : undefined}
                  className={cn(
                    'h-7 cursor-pointer whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    preset === id ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-card hover:text-foreground',
                  )}
                  data-preset={id}
                >
                  {t.presetNames[id]}
                </button>
              ))}
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-x-3 @md:grid-cols-2 @3xl:grid-cols-3" aria-label={t.title}>
            {TOOL_ROWS.map(({ system, tool }) => (
              <ToolRow
                key={tool.name}
                name={tool.name}
                system={system}
                systemName={tx.flow.nodes.systems[system]}
                readOnly={tool.readOnly}
                on={enabled.includes(tool.name)}
                disabled={running}
                lockId={running ? lockId : undefined}
              />
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] leading-snug text-[var(--ink-2)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-danger px-1.5 font-mono text-[10px] font-medium uppercase leading-4 text-[var(--red-ink)]"><PenLine aria-hidden="true" className="size-2.5" />{t.changesData}</span>
            {t.readOnlyNote}
            <InfoTip tip="markers" />
          </p>
        </div>
      )}
    </section>
  )
}

function ToolRow({ name, system, systemName, readOnly, on, disabled, lockId }: { name: ToolName; system: SystemId; systemName: string; readOnly: boolean; on: boolean; disabled: boolean; lockId?: string }) {
  const t = useT().learn.tools
  const id = useId()
  const Icon = SYSTEM_ICON[system]
  return (
    <li className="flex items-center gap-2 border-b border-hairline py-1" data-tool={name} data-on={on} data-system={system}>
      <span aria-hidden="true" className={cn('inline-grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-3.5', on ? 'bg-doc text-[var(--blue-ink)]' : 'bg-muted text-foreground')}><Icon /></span>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer leading-tight">
        <span className={cn('block truncate font-mono text-[11.5px]', on ? 'text-foreground' : 'text-[var(--ink-2)] line-through decoration-[var(--line-strong)]')}>{name}</span>
        <span className="block truncate text-[10.5px] text-[var(--ink-2)]">{systemName}</span>
      </label>
      {!readOnly && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-danger px-1.5 font-mono text-[9.5px] font-medium uppercase leading-4 text-[var(--red-ink)]" data-changes-data>
          <PenLine aria-hidden="true" className="size-2.5" />{t.changesData}
        </span>
      )}
      <Switch id={id} checked={on} onCheckedChange={(v) => setToolEnabled(name, v)} disabled={disabled} aria-describedby={lockId} data-tool-switch={name} />
    </li>
  )
}
