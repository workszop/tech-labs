import { useEffect } from 'react'
import { ArrowRight, BookOpen, Check, Coins, Download, FileSearch, FlaskConical, FolderTree, Gauge, GitCompare, Map as MapIcon, Microscope, Scissors, ShieldAlert, Tag, ThumbsUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getState, setSettings, setUi, useStore, type AppState, type Settings } from '@/state/store'
import { ask, buildIndex, downloadTestLog, previewChunking, removeFromIndex, selectFolder, toggleSelect } from '@/state/actions'
import { BATCH_DOC, CHECKS, CURRENT, DRAFT, REGISTER, ragRuns, type GuideQuestions } from '@/state/guideChecks'
import { getCorpus } from '@/data/corpus'
import { revealPanel } from '@/lib/reveal'
import { t, useT, type Dict } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { IconBadge, LearnCard, SectionCard } from './common'
import { useExplainers } from './explainers'

type StepId = keyof Dict['shell']['guide']['steps']

/**
 * The guide follows the workshop flow "RAG w organizacji" (Rybex, complaints assistant):
 * sources → unapproved draft out → where the app cuts a procedure → one change to the split →
 * chunk label → user testing (thumbs vs structured feedback) → four tests → test log. Each step checks the app state, so it ticks
 * itself when the team has really done it; a ticked step stays ticked.
 * Step logic only; texts come from the dictionary (`shell.guide.steps[id]`).
 */
interface GuideStep {
  id: StepId
  icon: React.ReactNode
  done: (s: AppState, q: GuideQuestions) => boolean
  run?: (q: GuideQuestions) => void | Promise<void>
  /** Questions shown as one-click chips under the step. */
  chips?: (q: GuideQuestions) => string[]
  topic?: string
}

const folderDocs = (folder: string) => getCorpus().documents.filter((d) => d.folder === folder).map((d) => d.id)
const NO_LABELS = { labelSection: false, labelMeta: false }
const DEFAULTS = { chunkSize: 400, overlap: 60, topK: 3, threshold: null, ...NO_LABELS }

/**
 * One workshop experiment: change settings and/or documents, rebuild the base when needed, come back
 * to the guide and ask the step's question. The chat shows the answer and its sources.
 */
async function experiment(o: { settings?: Partial<Settings>; add?: string[]; remove?: string[]; ask?: string }) {
  if (o.settings) setSettings(o.settings)
  if (o.remove?.length) await removeFromIndex(o.remove)
  const indexed = Object.keys(getState().index.documents)
  const add = (o.add ?? []).filter((id) => !indexed.includes(id))
  if (add.length) toggleSelect(add, true)
  if (add.length || o.settings) await buildIndex()
  setUi({ centerTab: 'guide' })
  if (o.ask) askFromGuide(o.ask)
}

/** The case documents without the draft (step 3) and the register with personal data (step 4). */
const complaintsNoDraft = () => folderDocs('complaints').filter((id) => id !== DRAFT && id !== REGISTER)

const STEPS: GuideStep[] = [
  {
    id: 'sources',
    icon: <FolderTree />,
    done: (s, q) => CHECKS.sources(s, q),
    run: () => {
      setSettings(DEFAULTS)
      selectFolder('complaints')
      setUi({ centerTab: 'build', mobileTab: 'lab' })
      revealPanel('docs')
    },
    chips: (q) => [q.guiding],
    topic: 'failures',
  },
  {
    id: 'refund',
    icon: <Coins />,
    done: (s, q) => CHECKS.refund(s, q),
    run: (q) => experiment({ settings: { topK: 1 }, add: folderDocs('complaints'), ask: q.refund }),
    chips: (q) => [q.refund],
    topic: 'cosine',
  },
  {
    id: 'outdated',
    icon: <Trash2 />,
    done: (s, q) => CHECKS.outdated(s, q),
    run: (q) => experiment({ remove: [DRAFT], ask: q.refund }),
    chips: (q) => [q.refund, q.guiding],
  },
  {
    id: 'personal',
    icon: <ShieldAlert />,
    done: (s, q) => CHECKS.personal(s, q),
    run: (q) => experiment({ remove: [REGISTER], ask: q.phone }),
    chips: (q) => [q.phone],
  },
  {
    id: 'split',
    icon: <Scissors />,
    // Only the chunk preview (a job with status 'cancelled', no embeddings) counts: building the index also chunks.
    done: (s) => !!s.job?.chunking && s.job.status === 'cancelled' && s.job.selection.docs.some((d) => d.id === CURRENT),
    run: async () => {
      setSettings({ chunkSize: 400, overlap: 60 })
      toggleSelect([CURRENT], true)
      setUi({ centerTab: 'build', mobileTab: 'lab' })
      await previewChunking()
    },
    topic: 'chunking',
  },
  {
    id: 'chunkTopk',
    icon: <FileSearch />,
    done: (s, q) => CHECKS.chunkTopk(s, q),
    // First half of the experiment; the second (top-k 3) is the chip after changing top-k in the chat.
    run: (q) => experiment({ settings: { ...NO_LABELS, chunkSize: 100, overlap: 0, topK: 1 }, add: complaintsNoDraft(), ask: q.guiding }),
    chips: (q) => [q.guiding],
    topic: 'chunking',
  },
  {
    id: 'diagnose',
    icon: <Microscope />,
    done: (s, q) => CHECKS.diagnose(s, q),
    run: (q) => experiment({ settings: DEFAULTS, add: [...complaintsNoDraft(), ...folderDocs('quality')], ask: q.batch }),
    chips: (q) => [q.batch],
    topic: 'failures',
  },
  {
    id: 'fixes',
    icon: <Tag />,
    done: (s, q) => CHECKS.fixes(s, q),
    // Each press tries the next fix not tried yet: section label, then top-k 5, then chunk size 200.
    run: (q) => {
      const runs = ragRuns(getState()).filter((r) => r.question === q.batch && r.index!.docIds.includes(BATCH_DOC))
      const add = [...complaintsNoDraft(), ...folderDocs('quality')]
      if (!runs.some((r) => r.index!.labels.includes('section'))) return experiment({ settings: { ...DEFAULTS, labelSection: true }, add, ask: q.batch })
      if (!runs.some((r) => r.topK >= 5)) return experiment({ settings: { ...DEFAULTS, topK: 5 }, add, ask: q.batch })
      return experiment({ settings: { ...DEFAULTS, chunkSize: 200 }, add, ask: q.batch })
    },
    chips: (q) => [q.batch],
  },
  {
    id: 'usertest',
    icon: <ThumbsUp />,
    // Simulated answers: no code needed; done once the team reached the reveal.
    done: (s) => s.ui.userTesting.round === 3,
    run: () => setUi({ centerTab: 'usertest', mobileTab: 'lab' }),
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
    id: 'threshold',
    icon: <Gauge />,
    done: (s, q) => ragRuns(s).some((r) => r.question === q.refund && r.threshold != null && r.index!.docIds.includes(DRAFT)),
    run: (q) => experiment({ settings: { ...DEFAULTS, threshold: 0.6 }, add: [DRAFT], ask: q.refund }),
    chips: (q) => [q.refund],
    topic: 'cosine',
  },
  {
    id: 'map',
    icon: <MapIcon />,
    done: (s) => s.ui.centerTab === 'map' && s.index.chunks.length > 0,
    run: () => setUi({ centerTab: 'map', mobileTab: 'lab' }),
    topic: 'embedding',
  },
  {
    id: 'compare',
    icon: <GitCompare />,
    done: (s) => Object.values(s.runs).some((r) => r.baseline?.status === 'completed'),
    run: () => {
      setSettings({ compareMode: true, ragEnabled: true })
      revealPanel('chat')
    },
    topic: 'compare',
  },
]

function askFromGuide(q: string) {
  revealPanel('chat')
  void ask(q)
}

export function Guide() {
  const state = useStore((s) => s)
  const authed = state.auth.status === 'active'
  const busy = Object.values(state.runs).some((r) => r.generate.status === 'processing' || r.embed.status === 'processing')
  const tx = useT().shell.guide
  const explainers = useExplainers()
  const sticky = state.ui.guideDone
  // The step questions, in the current language (tests: refund, batch, delivery, phone).
  const q: GuideQuestions = { guiding: tx.guiding, refund: tx.tests[0].question, batch: tx.tests[1].question, phone: tx.tests[3].question }
  const isDone = (st: GuideStep) => sticky.includes(st.id) || st.done(state, q)
  const doneCount = STEPS.filter(isDone).length
  const nextIdx = STEPS.findIndex((st) => !isDone(st))
  const doneLabel = useT().shell.common.status.completed

  // A step that was done once stays ticked, even after the team changes the index again.
  useEffect(() => {
    const newly = [...STEPS, ...EXTRAS].filter((st) => !sticky.includes(st.id) && st.done(state, q)).map((st) => st.id)
    if (newly.length) setUi({ guideDone: [...sticky, ...newly] })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- q follows the language, which is part of state
  }, [state, sticky])

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
        ? tx.tests.map((x) => chip(x.question, <><span className="font-semibold">{x.kind}:</span> {x.question}</>, x.question))
        : (st.chips?.(q) ?? []).map((x) => chip(x, <>{tx.ask}: {x}</>, x))
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
              <Button size="xs" variant={isNext ? 'accent' : 'outline'} onClick={() => void st.run!(q)}>
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
