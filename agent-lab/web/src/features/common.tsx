import * as React from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn, currentLocale } from '@/lib/utils'
import { getLang } from '@/i18n'

// ---------------------------------------------------------------- locale-aware formatting
// These read the current language at call time; components calling them re-render on a
// language change as long as they use useT() / useLang().

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

// ---------------------------------------------------------------- edulab building blocks

/** Colour roles: ink (neutral), doc (systems, blue), query (agent, grape), ok (success), warn (pending, yellow), danger (error), stone (inactive). */
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

export function EmptyState({ icon, tone = 'ink', title, children, action }: { icon: React.ReactNode; tone?: Tone; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <IconBadge size="lg" tone={tone}>{icon}</IconBadge>
      <div className="mt-1 font-display text-[17px] font-bold">{title}</div>
      {children && <div className="max-w-md text-[13.5px] leading-relaxed text-[var(--ink-2)]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
