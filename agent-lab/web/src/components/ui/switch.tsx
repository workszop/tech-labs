import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // edulab: on = solid yellow with an ink thumb; off = stone with a white thumb; full --line-strong contour in both.
      'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-input p-px transition-colors',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-foreground data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-card data-[state=unchecked]:ring-1 data-[state=unchecked]:ring-[var(--line-strong)]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'
