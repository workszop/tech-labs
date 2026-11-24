import { EmptyState, type Tone } from './common'

/** An empty, labelled panel of the three-panel layout. Later tasks replace it with the real panel. */
export function PlaceholderPanel({ icon, tone, title, text, panel }: { icon: React.ReactNode; tone: Tone; title: string; text: string; panel: string }) {
  return (
    <section className="h-full overflow-auto" data-panel={panel} aria-label={title}>
      <EmptyState icon={icon} tone={tone} title={title}>{text}</EmptyState>
    </section>
  )
}
