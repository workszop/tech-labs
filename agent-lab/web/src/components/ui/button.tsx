import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[var(--yellow-600)]',
        accent: 'bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:bg-[var(--yellow-600)]',
        outline: 'border border-input bg-card text-foreground hover:bg-accent',
        secondary: 'bg-muted text-foreground hover:bg-[var(--line)]',
        ghost: 'text-foreground hover:bg-accent',
        danger: 'bg-danger text-[var(--red-ink)] hover:bg-[var(--danger-600-press)]',
        link: 'rounded-[var(--r-xs)] font-sans text-doc underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-[13px]',
        xs: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        lg: 'h-10 px-5',
        icon: 'size-9',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  },
)
Button.displayName = 'Button'
