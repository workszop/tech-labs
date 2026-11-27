import { useEffect } from 'react'
import { ArrowRight, BookOpen, Check, Download, FileSearch, FlaskConical, FolderTree, GitCompare, Map as MapIcon, Scissors, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getState, setSettings, setUi, useStore, type AppState, type QueryRun } from '@/state/store'
import { ask, downloadTestLog, previewChunking, selectFolder, toggleSelect } from '@/state/actions'
import { goTo } from '@/state/nav'
import { t, useT, type Dict } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { IconBadge, LearnCard, SectionCard } from './common'
import { useExplainers } from './explainers'

type StepId = keyof Dict['shell']['guide']['steps']

/**
 * The guide follows the workshop flow "RAG w organizacji" (Rybex, complaints assistant):
 * sources → unapproved draft out → where the app cuts a procedure → one change to the split →
 * chunk label → four tests → test log. Each step checks the app state, so it ticks
 * itself when the team has really done it; a ticked step stays ticked.
 * Step logic only; texts come from the dictionary (`shell.guide.steps[id]`).
 */
interface GuideStep {
  id: StepId
  icon: React.ReactNode
  done: (s: AppState) => boolean
  run?: () => void | Promise<void>
  /** Show the guiding question as a one-click chip under the step. */
  askGuiding?: boolean
  topic?: string
}

const OUTDATED = 'proces-04-v6' // the unapproved draft that competes with the procedure in force
const CURRENT = 'proces-04'
const ragRuns = (s: AppState): QueryRun[] => Object.values(s.runs).filter((r) => r.ragEnabled && r.generate.status === 'completed' && !!r.index)

const STEPS: GuideStep[] = [
  {
    id: 'sources',
    icon: <FolderTree />,
    done: (s) => ragRuns(s).some((r) => r.index!.docIds.includes(OUTDATED)),
    run: () => {
      selectFolder('complaints')
      goTo('data')
    },
    askGuiding: true,
    topic: 'failures',
  },
  {
    id: 'outdated',
    icon: <Trash2 />,
    done: (s) => {
      const runs = ragRuns(s).sort((a, b) => a.createdAt - b.createdAt)
      const firstWith = runs.find((r) => r.index!.docIds.includes(OUTDATED))
      return !!firstWith && runs.some((r) => r.createdAt > firstWith.createdAt && !r.index!.docIds.includes(OUTDATED) && r.index!.docIds.includes(CURRENT))
    },
    run: () => {
      toggleSelect([OUTDATED], false)
      goTo('vectors')
    },
    askGuiding: true,
  },
  {
    id: 'split',
    icon: <Scissors />,
    // Only the chunk preview (a job with status 'cancelled', no embeddings) counts: building the index also chunks.
    done: (s) => !!s.job?.chunking && s.job.status === 'cancelled' && s.job.selection.docs.some((d) => d.id === CURRENT),
    run: async () => {
      setSettings({ chunkSize: 400, overlap: 60 })
      goTo('vectors')
      // Preview the procedure alone; the tick (membership) stays the team's decision.
      await previewChunking([CURRENT])
    },
    topic: 'chunking',
  },
  {
    id: 'size',
    icon: <FileSearch />,
    done: (s) => new Set(ragRuns(s).filter((r) => r.index!.docIds.includes(CURRENT)).map((r) => `${r.index!.chunkSize}/${r.index!.overlap}/${r.index!.labels}`)).size >= 2,
    run: showLatestContext,
    askGuiding: true,
    topic: 'cosine',
  },
  {
    id: 'label',
    icon: <Tag />,
    done: (s) => ragRuns(s).some((r) => r.index!.labels !== 'none'),
    run: () => {
      setSettings({ labelSection: true, labelMeta: true })
      goTo('vectors')
    },
    askGuiding: true,
  },
  {
    id: 'tests',
    icon: <FlaskConical />,
    done: (s) => {
      const asked = new Set(ragRuns(s).map((r) => r.question))
      return t().shell.guide.tests.every((q) => asked.has(q.question))
    },
    topic: 'failures',
  },
  {
    id: 'log',
    icon: <Download />,
    done: (s) => s.ui.logExported,
    run: () => downloadTestLog(),
  },
]

/** Extra explorations outside the workshop flow. */
const EXTRAS: GuideStep[] = [
  {
    id: 'map',
    icon: <MapIcon />,
    // The map lives only in the Tech face of Vector database; only the user flips the switch.
    done: (s) => s.ui.part === 'vectors' && s.settings.view === 'tech' && s.index.chunks.length > 0,
    run: () => goTo('vectors'),
    topic: 'embedding',
  },
  {
    id: 'compare',
    icon: <GitCompare />,
    done: (s) => Object.values(s.runs).some((r) => r.baseline?.status === 'completed'),
    run: () => {
      setSettings({ compareMode: true, ragEnabled: true })
      goToChat()
    },
    topic: 'compare',
  },
]

/** Open the Case part and put the cursor in the chat box. */
function goToChat() {
  goTo('case')
  // Wait for the part to render: an element that is not on screen yet cannot take focus.
  // Focus scrolls the box into view, which matters below 1024 px where the chat sits under the guide.
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-panel="chat"] textarea')?.focus())
}

/**
 * Open the Case part on the list of fragments under the latest answer (Students face), or on the
 * Retrieval tab (Tech face). Without an answer yet, the cursor goes to the chat box.
 */
function showLatestContext() {
  if (getState().settings.view === 'tech') {
    setUi({ part: 'case', caseTechTab: 'retrieval' })
    return
  }
  goTo('case')
  requestAnimationFrame(() => {
    const lists = document.querySelectorAll<HTMLElement>('[data-panel="chat"] [data-testid="context-list"]')
    const last = lists[lists.length - 1]
    if (!last) return document.querySelector<HTMLElement>('[data-panel="chat"] textarea')?.focus()
    last.scrollIntoView({ behavior: 'smooth', block: 'center' })
    last.focus({ preventScroll: true })
  })
}

function askFromGuide(q: string) {
  goToChat()
  void ask(q)
}

/**
 * Records steps the moment they are done, wherever the user is (mounted once in App): a step such as
 * the vector map is done in another part, while the guide itself is shown only in the Case part.
 * A step that was done once stays ticked, even after the team changes the index again.
 */
export function GuideTracker() {
  const state = useStore((s) => s)
  const sticky = state.ui.guideDone
  useEffect(() => {
    const newly = [...STEPS, ...EXTRAS].filter((st) => !sticky.includes(st.id) && st.done(state)).map((st) => st.id)
    if (newly.length) setUi({ guideDone: [...sticky, ...newly] })
  }, [state, sticky])
  return null
}

export function Guide() {
  const state = useStore((s) => s)
  const authed = state.auth.status === 'active'
  const busy = Object.values(state.runs).some((r) => r.generate.status === 'processing' || r.embed.status === 'processing')
  const tx = useT().shell.guide
  const explainers = useExplainers()
  const sticky = state.ui.guideDone
  const isDone = (st: GuideStep) => sticky.includes(st.id) || st.done(state)
  const doneCount = STEPS.filter(isDone).length
  const nextIdx = STEPS.findIndex((st) => !isDone(st))
  const doneLabel = useT().shell.common.status.completed

  const chip = (key: string, label: React.ReactNode, q: string) => (
    <button key={key} disabled={!authed || busy} onClick={() => askFromGuide(q)} className="rounded-full border border-input bg-card px-2.5 py-1 text-left text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
      {label}
    </button>
  )

  const renderStep = (st: GuideStep, i: number, extra: boolean) => {
    const done = isDone(st)
    const isNext = !extra && i === nextIdx
    const text: { module?: string; title: string; body: string; action?: string } = tx.steps[st.id]
    const showAction = !!(st.run && text.action && (isNext || !done))
    const topic = st.topic && explainers[st.topic] ? st.topic : null
    const chips =
      st.id === 'tests'
        ? tx.tests.map((q) => chip(q.question, <><span className="font-semibold">{q.kind}:</span> {q.question}</>, q.question))
        : st.askGuiding
          ? [chip('home', <>{tx.ask}: {tx.guiding}</>, tx.guiding)]
          : []
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
          <div className="min-w-0 flex-1">
            {text.module && <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{text.module}</div>}
            <h3 className="font-display text-[15.5px] font-bold leading-tight">{text.title}</h3>
          </div>
          {done && <Badge variant="ok"><Check strokeWidth={3} /> {doneLabel}</Badge>}
        </div>
        <p className="whitespace-pre-line px-4 py-3 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{text.body}</p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3" data-testid={`guide-questions-${st.id}`}>
            {chips}
            {!authed && <span className="self-center text-[11.5px] text-muted-foreground">{tx.needCode}</span>}
          </div>
        )}
        {(showAction || topic) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-dashed px-4 py-2.5">
            {showAction && (
              <Button size="xs" variant={isNext ? 'accent' : 'outline'} onClick={() => void st.run!()}>
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
  }

  return (
    <div className="mx-auto max-w-[54rem] space-y-5 px-4 py-6 sm:px-8 sm:py-8">
      <div className="border-b pb-5">
        <h2 className="font-display text-[clamp(1.6rem,3.2vw,2.1rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">{tx.title}</h2>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-[var(--ink-2)]">
          {tx.introBefore}<b className="font-semibold text-foreground">{tx.introCompany}</b>{tx.introAfter}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">{tx.introQuestion} <b className="font-semibold text-foreground">{tx.quote(tx.guiding)}</b></p>
      </div>
      <LearnCard topic="rag" />
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
        </div>
        <span className="font-mono text-xs text-foreground" data-testid="guide-progress">{tx.progress(doneCount, STEPS.length)}</span>
      </div>
      <ol className="space-y-3">{STEPS.map((st, i) => renderStep(st, i, false))}</ol>
      <div>
        <h3 className="mb-2 font-display text-[15px] font-bold">{tx.extrasTitle}</h3>
        <ol className="space-y-3">{EXTRAS.map((st, i) => renderStep(st, i, true))}</ol>
      </div>
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
