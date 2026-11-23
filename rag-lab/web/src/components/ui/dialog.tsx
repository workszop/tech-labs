import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  wide,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }) {
  const closeLabel = useT().shell.common.close
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-card text-card-foreground shadow-lg outline-none',
          wide ? 'max-w-4xl' : 'max-w-lg',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-full p-1.5 text-foreground transition-colors hover:bg-muted cursor-pointer" aria-label={closeLabel}>
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 rounded-t-[inherit] border-b border-hairline bg-subtle px-5 py-4 pr-12', className)} {...props} />
}
export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn('font-display text-lg font-bold leading-tight tracking-tight text-foreground', className)} {...props} />)
DialogTitle.displayName = 'DialogTitle'
export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn('text-[13px] text-muted-foreground', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4', className)} {...props} />
}
