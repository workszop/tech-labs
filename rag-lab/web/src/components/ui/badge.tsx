import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 font-mono text-[11px] font-medium leading-4 tracking-[0.02em] whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground',
        outline: 'border-input text-foreground',
        doc: 'bg-doc text-[var(--blue-ink)]',
        query: 'bg-query text-[var(--grape-ink)]',
        ok: 'bg-ok text-[var(--green-ink)]',
        warn: 'bg-warn text-[var(--yellow-ink)]',
        danger: 'bg-danger text-[var(--red-ink)]',
        solid: 'bg-foreground text-background',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
