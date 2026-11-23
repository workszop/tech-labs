import { cn } from '@/lib/utils'

// edulab ink mark (black horse) from web/public; BASE_URL keeps it working under a sub-path base.
const MARK_SRC = `${import.meta.env.BASE_URL}edulab-mark-ink.png`

export function Logo({ className }: { className?: string }) {
  return <img src={MARK_SRC} alt="edulab" width={44} height={44} draggable={false} className={cn('-mr-1.5 size-11 shrink-0 select-none', className)} />
}
