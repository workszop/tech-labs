/**
 * The Learn dialog: twelve short explanations (topic list on the left, one
 * topic on the right; on phones one at a time). Each topic is a lead, two or
 * three points, an "In this lab" example card with an optional "show me"
 * action, and at most one fold. The last topic is the chatbot / RAG / agent
 * comparison.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookText, Bot, ChevronRight, Crosshair, FlaskConical, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { TopicText } from '@/i18n/en/learn'
import { IconBadge } from '../common'
import { closeLearn, setLearnTopic, showTarget, useLearnState } from './bus'
import { GROUP_TONE, TOPICS, type TopicDef, type TopicGroup, type TopicId } from './topics'

const GROUPS: TopicGroup[] = ['basics', 'systems', 'safety', 'compare']

export function LearnDialog() {
  const tx = useT().learn
  const { open, topic, list } = useLearnState()
  // Phones show the list or one topic; the list first when the dialog opens without a topic request.
  const [mobileList, setMobileList] = useState(list)
  useEffect(() => {
    if (open) setMobileList(list)
  }, [open, list])
  const article = useRef<HTMLDivElement>(null)
  const pendingShow = useRef<TopicDef['show'] | null>(null)
  const def = TOPICS.find((x) => x.id === topic) ?? TOPICS[0]!
  const index = TOPICS.indexOf(def)

  useEffect(() => {
    article.current?.scrollTo({ top: 0 })
  }, [topic])

  const pick = (id: TopicId) => {
    setLearnTopic(id)
    setMobileList(false)
    requestAnimationFrame(() => article.current?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true }))
  }

  const showMe = () => {
    pendingShow.current = def.show ?? null
    closeLearn()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeLearn()}>
      <DialogContent
        wide
        className="h-[88vh] max-w-5xl"
        data-testid="learn-dialog"
        onCloseAutoFocus={(e) => {
          const target = pendingShow.current
          pendingShow.current = null
          if (target) {
            e.preventDefault()
            showTarget(target)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{tx.dialog.title}</DialogTitle>
          <DialogDescription>{tx.dialog.description}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label={tx.dialog.topicsLabel}
            className={cn('scroll-thin w-full shrink-0 overflow-y-auto border-hairline bg-subtle p-2.5 md:block md:w-64 md:border-r', mobileList ? 'block' : 'hidden')}
            data-testid="learn-topics"
          >
            {GROUPS.map((g) => (
              <div key={g} className="mb-2.5 last:mb-0">
                <div className="px-2 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{tx.dialog.groups[g]}</div>
                <ul className="space-y-0.5">
                  {TOPICS.filter((x) => x.group === g).map((x) => {
                    const Icon = x.icon
                    const on = x.id === topic
                    return (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => pick(x.id)}
                          aria-current={on ? 'true' : undefined}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-left text-[13px] font-semibold leading-tight transition-colors',
                            on ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground',
                          )}
                          data-topic={x.id}
                        >
                          <IconBadge size="sm" tone={GROUP_TONE[x.group]} className="size-6 rounded-full [&_svg]:size-3.5"><Icon /></IconBadge>
                          <span className="min-w-0 flex-1">{tx.topics[x.id].title}</span>
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 md:hidden" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div ref={article} className={cn('scroll-thin min-w-0 flex-1 overflow-y-auto md:block', mobileList ? 'hidden' : 'block')}>
            <div className="border-b border-hairline px-4 py-2 md:hidden">
              <Button size="xs" variant="outline" onClick={() => setMobileList(true)} data-testid="learn-all-topics"><ArrowLeft />{tx.dialog.allTopics}</Button>
            </div>
            <Topic def={def} onShow={def.show ? showMe : undefined} />
            <div className="flex items-center justify-between gap-2 border-t border-dashed px-5 py-3">
              <Button size="sm" variant="outline" onClick={() => pick(TOPICS[index - 1]!.id)} disabled={index === 0}><ArrowLeft />{tx.dialog.prev}</Button>
              <span className="font-mono text-[11px] text-[var(--ink-2)]">{tx.dialog.position(index + 1, TOPICS.length)}</span>
              <Button size="sm" variant="outline" onClick={() => pick(TOPICS[index + 1]!.id)} disabled={index === TOPICS.length - 1}>{tx.dialog.next}<ArrowRight /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Topic({ def, onShow }: { def: TopicDef; onShow?: () => void }) {
  const tx = useT().learn
  const text: TopicText = tx.topics[def.id]
  const Icon = def.icon
  return (
    <article className="@container space-y-4 px-5 py-5" data-topic-article={def.id}>
      <div className="flex items-center gap-3">
        <IconBadge size="lg" tone={GROUP_TONE[def.group]}><Icon /></IconBadge>
        <h3 tabIndex={-1} className="font-display text-[22px] font-bold leading-tight outline-none">{text.title}</h3>
      </div>
      <p className="text-[15px] leading-relaxed text-foreground">{text.lead}</p>
      {text.points.length > 0 && (
        <ul className="space-y-1.5">
          {text.points.map((p) => (
            <li key={p} className="flex gap-2 text-[14px] leading-snug text-[var(--ink-2)]">
              <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {def.id === 'compare' && <CompareTable />}
      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label={tx.dialog.inLab}>
        <div className="flex items-center gap-2 border-b border-hairline bg-subtle px-3 py-1.5">
          <IconBadge size="sm" className="size-6 [&_svg]:size-3.5"><FlaskConical /></IconBadge>
          <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]">{tx.dialog.inLab}</span>
        </div>
        <p className="px-3 py-2.5 text-[14px] leading-relaxed">{text.example}</p>
        {onShow && text.showMe && (
          <div className="border-t border-dashed px-3 py-2">
            <Button size="sm" onClick={onShow} data-testid="learn-show-me"><Crosshair />{text.showMe}</Button>
          </div>
        )}
      </section>
      {text.more && (
        <details className="group rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 font-display text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
            {tx.dialog.more}
            <span aria-hidden="true" className="font-mono group-open:hidden">+</span>
            <span aria-hidden="true" className="hidden font-mono group-open:inline">−</span>
          </summary>
          <p className="border-t border-dashed px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{text.more}</p>
        </details>
      )}
    </article>
  )
}

const COLUMNS = [
  { id: 'chatbot', icon: MessageCircle, tone: 'ink' },
  { id: 'rag', icon: BookText, tone: 'doc' },
  { id: 'agent', icon: Bot, tone: 'query' },
] as const

/** Chatbot / RAG / agent: three cards side by side on a wide dialog, stacked on phones. */
function CompareTable() {
  const tx = useT().learn.compareTable
  return (
    <div className="grid grid-cols-1 gap-2.5 @2xl:grid-cols-3" data-testid="learn-compare-table">
      {COLUMNS.map((c) => {
        const Icon = c.icon
        return (
          <section key={c.id} className="overflow-hidden rounded-lg border border-border bg-card" aria-label={tx.columns[c.id]}>
            <div className="flex items-center gap-2 border-b border-hairline bg-subtle px-3 py-2">
              <IconBadge size="sm" tone={c.tone}><Icon /></IconBadge>
              <h4 className="font-display text-[15px] font-bold">{tx.columns[c.id]}</h4>
            </div>
            <dl className="divide-y divide-[var(--line)]">
              {tx.rows.map((r) => (
                <div key={r.label} className="px-3 py-1.5">
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">{r.label}</dt>
                  <dd className="text-[13.5px] leading-snug">{r[c.id]}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}
