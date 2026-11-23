import { ArrowRight, BookOpen, Check, FileSearch, FlaskConical, FolderTree, GitCompare, Hammer, Map as MapIcon, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setSettings, setUi, useStore, type AppState } from '@/state/store'
import { revealPanel } from '@/lib/reveal'
import { useT, type Dict } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { IconBadge, LearnCard, SectionCard } from './common'
import { useExplainers } from './explainers'

type StepId = keyof Dict['shell']['guide']['steps']

/** Step logic only; titles, bodies and action labels come from the dictionary (`shell.guide.steps[id]`). */
interface GuideStep {
  id: StepId
  icon: React.ReactNode
  done: (s: AppState) => boolean
  run?: () => void
  topic?: string
}

const STEPS: GuideStep[] = [
  {
    id: 'pick',
    icon: <FolderTree />,
    done: (s) => s.selection.length > 0 || s.index.chunks.length > 0,
    run: () => revealPanel('docs'),
  },
  {
    id: 'build',
    icon: <Hammer />,
    done: (s) => s.index.chunks.length > 0,
    run: () => setUi({ centerTab: 'build', mobileTab: 'lab' }),
    topic: 'chunking',
  },
  {
    id: 'map',
    icon: <MapIcon />,
    done: (s) => s.ui.centerTab === 'map' && s.index.chunks.length > 0,
    run: () => setUi({ centerTab: 'map', mobileTab: 'lab' }),
    topic: 'embedding',
  },
  {
    id: 'ask',
    icon: <MessageSquare />,
    done: (s) => Object.values(s.runs).some((r) => r.ragEnabled && r.generate.status === 'completed'),
    run: () => revealPanel('chat'),
    topic: 'similarity',
  },
  {
    id: 'inspect',
    icon: <FileSearch />,
    done: (s) => s.ui.centerTab === 'retrieval' && !!s.activeRunId,
    run: () => setUi({ centerTab: 'retrieval', mobileTab: 'lab' }),
    topic: 'cosine',
  },
  {
    id: 'compare',
    icon: <GitCompare />,
    done: (s) => Object.values(s.runs).some((r) => r.baseline?.status === 'completed'),
    run: () => { setSettings({ compareMode: true, ragEnabled: true }); revealPanel('chat') },
    topic: 'compare',
  },
  {
    id: 'experiment',
    icon: <FlaskConical />,
    done: (s) => !!s.index.meta && (s.index.meta.chunkSize !== 400 || s.settings.topK !== 3),
    topic: 'failures',
  },
]

export function Guide() {
  const state = useStore((s) => s)
  const tx = useT().shell.guide
  const explainers = useExplainers()
  const doneCount = STEPS.filter((st) => st.done(state)).length
  const nextIdx = STEPS.findIndex((st) => !st.done(state))
  const doneLabel = useT().shell.common.status.completed
  return (
    <div className="mx-auto max-w-[54rem] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
      <div className="border-b pb-5">
        <h2 className="font-display text-[clamp(1.6rem,3.2vw,2.1rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">{tx.title}</h2>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-[var(--ink-2)]">
          {tx.introBefore}<b className="font-semibold text-foreground">{tx.introCompany}</b>{tx.introAfter}
        </p>
      </div>
      <LearnCard topic="rag" />
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
        </div>
        <span className="font-mono text-xs text-foreground">{tx.progress(doneCount, STEPS.length)}</span>
      </div>
      <ol className="space-y-3">
        {STEPS.map((st, i) => {
          const done = st.done(state)
          const isNext = i === nextIdx
          const text: { title: string; body: string; action?: string } = tx.steps[st.id]
          const showAction = !!(st.run && text.action && (isNext || !done))
          const topic = st.topic && explainers[st.topic] ? st.topic : null
          return (
            <li
              key={st.id}
              data-guide-step={st.id}
              data-done={done}
              data-next={isNext}
              className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', isNext && 'border-[var(--yellow)] shadow-[0_0_0_3px_var(--yellow)]')}
            >
              <div className="flex items-center gap-2.5 border-b border-hairline bg-subtle px-4 py-2.5">
                <IconBadge tone={done ? 'ok' : isNext ? 'ink' : 'stone'}>{done ? <Check strokeWidth={3} /> : st.icon}</IconBadge>
                <h3 className="min-w-0 flex-1 font-display text-[15.5px] font-bold leading-tight">{text.title}</h3>
                {done && <Badge variant="ok"><Check strokeWidth={3} /> {doneLabel}</Badge>}
              </div>
              <p className="px-4 py-3 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{text.body}</p>
              {(showAction || topic) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed px-4 py-2.5">
                  {showAction && (
                    <Button size="xs" variant={isNext ? 'accent' : 'outline'} onClick={st.run}>
                      {text.action} <ArrowRight />
                    </Button>
                  )}
                  {topic && (
                    <button className="ml-auto text-xs font-medium text-doc underline underline-offset-2 cursor-pointer" onClick={() => setUi({ learnTopic: topic })}>
                      {explainers[topic].title}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <SectionCard icon={<BookOpen />} title={tx.concepts}>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(explainers).map(([k, e]) => (
            <button key={k} onClick={() => setUi({ learnTopic: k })} className="rounded-full border border-input bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted cursor-pointer">
              {e.title}
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
