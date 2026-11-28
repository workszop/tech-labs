import * as React from 'react'
import { AlertTriangle, Check, CheckCircle2, CircleDashed, Info, Lightbulb, Loader2, Minus, MinusCircle, X, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { cn, currentLocale } from '@/lib/utils'
import { setUi, type StageStatus } from '@/state/store'
import { useExplainers } from './explainers'
import { getCorpus } from '@/data/corpus'
import { getLang, t, useT } from '@/i18n'
import { docFlag } from '@/data/docFlag'

// ---------------------------------------------------------------- locale-aware formatting
// These read the current language at call time; components calling them re-render on a
// language change as long as they use useT() / useLang() / useCorpus().

/** BCP 47 locale of the current UI language (one helper, shared with `state/`). */
export { currentLocale }
/** Rounded integer with the grouping of the current language (12 345 / 12,345). */
export function fmtNumber(n: number): string {
  return new Intl.NumberFormat(currentLocale()).format(Math.round(n))
}
/** Dollar amount: "$0.42" in English, "0,42 USD" in Polish. Tiny amounts keep 5 decimals. */
export function fmtUsd(n: number): string {
  const digits = n !== 0 && n < 0.01 ? 5 : 2
  if (getLang() === 'en') return `$${n.toFixed(digits)}`
  return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} USD`
}
/** Date and time in the current language. */
export function fmtDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(currentLocale())
}

/** Small (i) icon: hover for the short explanation, click for the full explainer. */
export function Explain({ topic, className, label }: { topic: string; className?: string; label?: string }) {
  const ex = useExplainers()[topic]
  const tx = useT().shell.common
  if (!ex) return null
  return (
    <Tooltip
      content={
        <span>
          <b className="font-semibold">{ex.title}</b>
          <br />
          {ex.short}
          <br />
          <span className="text-[var(--yellow)]">{tx.explainMore}</span>
        </span>
      }
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setUi({ learnTopic: topic })
        }}
        className={cn('inline-flex items-center gap-1 rounded text-muted-foreground hover:text-foreground cursor-help align-middle', className)}
        aria-label={tx.explainAria(ex.title)}
      >
        <Info className="size-3.5" />
        {label && <span className="text-xs underline decoration-dotted underline-offset-2">{label}</span>}
      </button>
    </Tooltip>
  )
}

// ---------------------------------------------------------------- edulab building blocks

export type Tone = 'ink' | 'doc' | 'query' | 'ok' | 'warn' | 'danger' | 'stone'

const BADGE_TONE: Record<Tone, string> = {
  ink: 'bg-foreground text-[var(--yellow)]',
  doc: 'bg-doc text-white',
  query: 'bg-query text-white',
  ok: 'bg-ok text-white',
  warn: 'bg-primary text-primary-foreground',
  danger: 'bg-danger text-white',
  stone: 'bg-muted text-foreground',
}

/** Lucide icon in a solid rounded square. Default: ink fill with a yellow icon; 34 px on card heads. */
export function IconBadge({ tone = 'ink', size = 'md', className, children }: { tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string; children: React.ReactNode }) {
  const sizeCls = { sm: 'size-7 rounded-md [&_svg]:size-4', md: 'size-[34px] rounded-md [&_svg]:size-[18px]', lg: 'size-[46px] rounded-lg [&_svg]:size-6' }[size]
  return <span aria-hidden="true" className={cn('inline-grid shrink-0 place-items-center', sizeCls, BADGE_TONE[tone], className)}>{children}</span>
}

/**
 * Card anatomy: neutral contour, stone head strip (icon badge + display title + meta),
 * white body, optional foot behind a dashed rule (actions, meta).
 */
export function SectionCard({
  icon,
  tone,
  title,
  as: Heading = 'h3',
  explain,
  right,
  foot,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  icon?: React.ReactNode
  tone?: Tone
  title: React.ReactNode
  as?: 'h2' | 'h3'
  explain?: string
  right?: React.ReactNode
  foot?: React.ReactNode
  bodyClassName?: string
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)} {...rest}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-hairline bg-subtle px-4 py-2.5">
        {icon && <IconBadge tone={tone}>{icon}</IconBadge>}
        <Heading className="min-w-0 font-display text-[15px] font-bold leading-tight">{title}</Heading>
        {explain && <Explain topic={explain} />}
        {right && <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-muted-foreground">{right}</span>}
      </header>
      {children !== undefined && children !== null && children !== false && <div className={cn('px-4 py-3.5', bodyClassName)}>{children}</div>}
      {foot && <footer className="flex flex-wrap items-center gap-2 border-t border-dashed px-4 py-2.5">{foot}</footer>}
    </section>
  )
}

/** The user's question as a full solid grape block (the "question" colour of the map and the pipeline). */
export function QuestionQuote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('rounded-lg bg-query px-3.5 py-2.5 text-[14px] leading-snug text-white', className)}>{children}</p>
}

/**
 * Educational note. Long reading text sits on a neutral stone block with an icon badge
 * in the tone colour (a full blue or yellow block is tiring over several lines).
 */
export function LearnCard({ topic, children, tone = 'doc', className }: { topic?: string; children?: React.ReactNode; tone?: 'doc' | 'query' | 'warn' | 'ok'; className?: string }) {
  const explainers = useExplainers()
  const tx = useT().shell.common
  const ex = topic ? explainers[topic] : null
  return (
    <div className={cn('flex gap-3 rounded-lg border border-hairline bg-subtle px-3.5 py-3 text-[13px] leading-relaxed', className)}>
      <IconBadge tone={tone} size="sm" className="mt-0.5">{tone === 'warn' ? <Info /> : <Lightbulb />}</IconBadge>
      <div className="min-w-0 flex-1">
        {ex && (
          <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-3">
            <span className="font-display text-[14px] font-bold">{ex.title}</span>
            <button className="text-xs font-medium text-doc underline underline-offset-2 cursor-pointer" onClick={() => setUi({ learnTopic: topic! })}>
              {tx.learnMore}
            </button>
          </div>
        )}
        <div className="text-[var(--ink-2)]">{children ?? ex?.short}</div>
      </div>
    </div>
  )
}

export function StatusIcon({ status, className }: { status: StageStatus; className?: string }) {
  const cls = cn('size-4 shrink-0', className)
  const labels = useT().shell.common.status
  switch (status) {
    case 'processing':
      return <Loader2 className={cn(cls, 'animate-spin text-doc')} aria-label={labels.processing} />
    case 'completed':
      return <CheckCircle2 className={cn(cls, 'text-ok')} aria-label={labels.completed} />
    case 'error':
      return <XCircle className={cn(cls, 'text-danger')} aria-label={labels.error} />
    case 'skipped':
      return <MinusCircle className={cn(cls, 'text-muted-foreground')} aria-label={labels.skipped} />
    default:
      return <CircleDashed className={cn(cls, 'text-muted-foreground')} aria-label={labels.waiting} />
  }
}

/** Status labels for the current language; re-renders the component when the language changes. */
export function useStatusLabels(): Record<StageStatus, string> {
  return useT().shell.common.status
}

/** Status as a solid chip: done = green with a check, running = yellow, error = red, waiting = stone. */
export function StatusBadge({ status, className }: { status: StageStatus; className?: string }) {
  const labels = useT().shell.common.status
  switch (status) {
    case 'processing':
      return <Badge variant="warn" className={className}><Loader2 className="animate-spin" /> {labels.processing}</Badge>
    case 'completed':
      return <Badge variant="ok" className={className}><Check strokeWidth={3} /> {labels.completed}</Badge>
    case 'error':
      return <Badge variant="danger" className={className}><X strokeWidth={3} /> {labels.error}</Badge>
    case 'skipped':
      return <Badge className={className}><Minus /> {labels.skipped}</Badge>
    default:
      return <Badge className={className}>{labels.waiting}</Badge>
  }
}

/**
 * Compatibility export: each property reads the current language at access time.
 * Prefer `useStatusLabels()` in components (this object does not subscribe to language changes).
 */
export const STATUS_LABEL: Record<StageStatus, string> = {
  get waiting() { return t().shell.common.status.waiting },
  get processing() { return t().shell.common.status.processing },
  get completed() { return t().shell.common.status.completed },
  get error() { return t().shell.common.status.error },
  get skipped() { return t().shell.common.status.skipped },
}

/** Callout: one full solid colour block, text in the block's own ink (white, ink on yellow). */
export function Alert({ tone = 'warn', title, children, action, className }: { tone?: 'warn' | 'danger' | 'ok' | 'doc'; title?: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const map = {
    warn: 'bg-primary text-primary-foreground',
    danger: 'bg-danger text-white',
    ok: 'bg-ok text-white',
    doc: 'bg-doc text-white',
  }[tone]
  const Icon = { warn: AlertTriangle, danger: XCircle, ok: CheckCircle2, doc: Info }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('edu-block flex gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed', map, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-display text-[14px] font-bold">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  )
}

/** First values of a vector, drawn as tiny diverging bars plus numbers. */
export function VectorPreview({ values, dims, label }: { values: number[]; dims: number; label?: string }) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1e-6)
  const tx = useT().shell.common
  return (
    <div className="rounded-lg border border-hairline bg-subtle p-2.5">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-foreground">
        <span>{tx.vectorHead(label ?? tx.vector, values.length, fmtNumber(dims))}</span>
      </div>
      <div className="flex h-10 items-center gap-[3px]">
        {values.map((v, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col justify-center" title={v.toFixed(6)}>
            <div className={cn('mx-auto w-full max-w-3 rounded-[2px]', v >= 0 ? 'bg-doc' : 'bg-query')} style={{ height: `${(Math.abs(v) / max) * 50}%`, transform: v >= 0 ? 'translateY(-50%)' : 'translateY(50%)' }} />
          </div>
        ))}
      </div>
      <div className="mt-1 font-mono text-[10.5px] leading-relaxed text-muted-foreground break-all">
        [{values.map((v) => (v >= 0 ? ' ' : '') + v.toFixed(4)).join(', ')}, … ]
      </div>
      {values.every((v) => v === 0) && <div className="mt-1 text-[11px] text-muted-foreground">{tx.vectorAllZero}</div>}
    </div>
  )
}

export function ScoreBar({ score, highlight, className }: { score: number; highlight?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(1, score)) * 100
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', highlight ? 'bg-ok' : 'bg-[var(--line-strong)]')} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('w-12 text-right font-mono text-xs tabular-nums', highlight ? 'font-medium text-ok' : 'text-muted-foreground')}>{score.toFixed(3)}</span>
    </div>
  )
}

/**
 * Folder colours as literal edulab hex: they feed Plotly marker fills and inline styles,
 * where CSS variables do not resolve. Five categorical tones, each >= 3:1 on white.
 * Grape is left out on purpose (it is the colour of the user's question), red means risk.
 */
export const FOLDER_COLORS: Record<string, string> = {
  complaints: '#177AA8', // --blue-600
  quality: '#078342', // --green-600
  production: '#C6478B', // --play-berry
  hygiene: '#9A7B00', // ochre: a deep step of --yellow
  staff: '#625B53', // --ink-3
}
export function folderColor(id: string) {
  return FOLDER_COLORS[id] ?? '#44403C' // --ink-2
}
export function FolderDot({ folder, className }: { folder: string; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: folderColor(folder) }} />
}
export function folderLabel(id: string) {
  return getCorpus().folders.find((f) => f.id === id)?.name ?? id
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-subtle px-3 py-2">
      <div className="truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-display text-[17px] font-bold tabular-nums">{value}</div>
      {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

// Segmented toggle: borderless stone track, each option a full pill, the active one solid yellow.
export const SEG = 'inline-flex gap-0.5 rounded-full bg-subtle p-[3px]'
export const segItem = (on: boolean) => cn('cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors', on ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <IconBadge size="lg">{icon}</IconBadge>
      <div className="mt-1 font-display text-[17px] font-bold">{title}</div>
      {children && <div className="max-w-md text-[13.5px] leading-relaxed text-[var(--ink-2)]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Render chunk text with the overlapping prefix/suffix highlighted. */
/** The label line in front of a chunk (see rag/chunkHeader.ts), shown apart from the chunk's own text. */
export function ChunkLabelLine({ label }: { label: string }) {
  if (!label) return null
  return <span data-testid="chunk-label" className="mb-0.5 block font-mono text-[11px] leading-snug text-doc">{label}</span>
}

export function ChunkText({ text, labelChars = 0, overlapPrevChars = 0, overlapNextChars = 0, className }: { text: string; labelChars?: number; overlapPrevChars?: number; overlapNextChars?: number; className?: string }) {
  const label = labelChars > 0 ? text.slice(0, labelChars).trimEnd() : ''
  const body = labelChars > 0 ? text.slice(labelChars) : text
  const a = Math.min(overlapPrevChars, body.length)
  const b = Math.max(a, body.length - overlapNextChars)
  const tx = useT().shell.common
  return (
    <p className={cn('whitespace-pre-wrap text-[13px] leading-relaxed', className)}>
      <ChunkLabelLine label={label} />
      {a > 0 && <mark className="mark-overlap text-inherit" title={tx.overlapPrev}>{body.slice(0, a)}</mark>}
      {body.slice(a, b)}
      {b < body.length && <mark className="mark-overlap text-inherit" title={tx.overlapNext}>{body.slice(b)}</mark>}
    </p>
  )
}

export { docFlag, type DocFlag } from '@/data/docFlag'
/** True for documents that should not be relied on: outdated or draft. */
export function isOutdatedDoc(docId: string): boolean {
  const f = docFlag(docId)
  return f === 'outdated' || f === 'draft'
}
