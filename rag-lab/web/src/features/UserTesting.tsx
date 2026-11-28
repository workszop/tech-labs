import { ArrowRight, Check, MessageSquareText, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { advanceUserTesting, updateUserTesting, useStore } from '@/state/store'
import { canAdvance, resetUserTesting, tagHits, thumbsSummary, toggleTag, toggleThumb, type Thumb } from '@/state/userTesting'
import { FEEDBACK_TAGS, SCENARIOS, type Scenario } from '@/data/userTesting'
import { useCorpus } from '@/data/corpus'
import { useLang, useT } from '@/i18n'
import { IconBadge, QuestionQuote, SectionCard } from './common'

const IDS = SCENARIOS.map((s) => s.id)

/**
 * User testing exercise: the same seven simulated answers rated with thumbs (round 1), then with
 * structured tags (round 2), then the reveal of the real cause and fix (round 3).
 * DOM contract: root [data-testid=user-testing][data-round]; cards [data-scenario][data-thumb][data-tags].
 */
export function UserTesting() {
  const ut = useStore((s) => s.ui.userTesting)
  const tx = useT().shell.userTesting
  const ready = canAdvance(ut, IDS)
  const rated = ut.round === 1 ? IDS.filter((id) => ut.thumbs[id]).length : IDS.filter((id) => (ut.tags[id]?.length ?? 0) > 0).length
  const sum = thumbsSummary(ut)

  const next = (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="accent" size="sm" disabled={!ready} onClick={advanceUserTesting} data-testid="ut-next">
        {ut.round === 1 ? tx.next1 : tx.next2} <ArrowRight />
      </Button>
      {!ready && <span className="text-[12.5px] text-muted-foreground">{tx.rateAll(IDS.length)}</span>}
    </div>
  )

  return (
    <div className="mx-auto max-w-[54rem] space-y-5 px-4 py-6 sm:px-8 sm:py-8" data-testid="user-testing" data-round={ut.round}>
      <div className="border-b pb-5">
        <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">{tx.title}</h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--ink-2)]">{tx.lead}</p>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">{tx.offline}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-[15px] font-bold">{ut.round === 3 ? tx.results : tx.round(ut.round)}</span>
        {ut.round < 3 && <span className="font-mono text-xs" data-testid="ut-progress">{tx.rated(rated, IDS.length)}</span>}
        <Button variant="ghost" size="xs" className="ml-auto" onClick={() => updateUserTesting(() => resetUserTesting())} data-testid="ut-reset">
          <RotateCcw /> {tx.reset}
        </Button>
      </div>
      {ut.round < 3 && <p className="text-[13.5px] text-[var(--ink-2)]">{ut.round === 1 ? tx.round1Hint : tx.round2Hint}</p>}

      {ut.round === 3 && <ResultsTable />}

      <ol className="space-y-3">
        {SCENARIOS.map((sc, i) => (
          <ScenarioCard key={sc.id} sc={sc} n={i + 1} />
        ))}
      </ol>

      {ut.round === 1 && ready && (
        <SectionCard icon={<ThumbsUp />} tone="query" title={tx.thumbsSummaryTitle} data-testid="ut-thumbs-summary">
          <p className="font-mono text-[20px] font-semibold">
            {sum.up} 👍 · {sum.down} 👎
          </p>
          <p className="mt-2 text-[14px] text-[var(--ink-2)]">{tx.thumbsQuestion}</p>
        </SectionCard>
      )}
      {ut.round < 3 && next}
      {ut.round === 3 && (
        <p className="rounded-xl border-2 border-foreground bg-card px-4 py-3 text-[14.5px] leading-relaxed" data-testid="ut-lesson">
          {tx.lesson}
        </p>
      )}
    </div>
  )
}

function ThumbIcon({ t }: { t: Thumb | undefined }) {
  if (t === 'up') return <ThumbsUp className="size-4 text-ok" />
  if (t === 'down') return <ThumbsDown className="size-4 text-danger" />
  return <span className="text-muted-foreground">–</span>
}

function ScenarioCard({ sc, n }: { sc: Scenario; n: number }) {
  const ut = useStore((s) => s.ui.userTesting)
  const tx = useT().shell.userTesting
  const text = sc.text[useLang()]
  const corpus = useCorpus()
  const thumb = ut.thumbs[sc.id]
  const tags = ut.tags[sc.id] ?? []
  const hit = tagHits(ut, sc)

  const thumbBtn = (t: Thumb) => {
    const active = thumb === t
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={t === 'up' ? tx.thumbUp : tx.thumbDown}
        data-testid={`thumb-${t}`}
        onClick={() => updateUserTesting((u) => toggleThumb(u, sc.id, t))}
        className={cn(
          'inline-flex size-10 items-center justify-center rounded-full border transition-colors cursor-pointer [&_svg]:size-[18px]',
          active ? (t === 'up' ? 'border-transparent bg-ok text-white' : 'border-transparent bg-danger text-white') : 'border-input bg-card hover:bg-muted',
        )}
      >
        {t === 'up' ? <ThumbsUp /> : <ThumbsDown />}
      </button>
    )
  }

  return (
    <li className="overflow-hidden rounded-xl border bg-card shadow-sm" data-scenario={sc.id} data-thumb={thumb ?? ''} data-tags={tags.join(',')}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-subtle px-4 py-2">
        <IconBadge size="sm" tone="stone">
          <MessageSquareText />
        </IconBadge>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {tx.answerLabel} · {n}/{SCENARIOS.length}
        </span>
      </div>
      <div className="space-y-2.5 px-4 py-3">
        <QuestionQuote className="text-[13.5px]">{text.question}</QuestionQuote>
        <p className="text-[14px] leading-relaxed">{text.answer}</p>
        <p className="text-[12.5px] text-muted-foreground">
          {tx.sources}{' '}
          {sc.citedDocIds.length ? sc.citedDocIds.map((id) => corpus.docById[id]?.title ?? id).join(' · ') : <i>{tx.noSources}</i>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-dashed px-4 py-2.5">
        {ut.round === 1 && (
          <div className="ml-auto flex gap-2">
            {thumbBtn('up')}
            {thumbBtn('down')}
          </div>
        )}
        {ut.round >= 2 && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            {tx.yourThumb} <ThumbIcon t={thumb} />
          </span>
        )}
        {ut.round === 2 && (
          <div className="flex w-full flex-wrap gap-1.5">
            {FEEDBACK_TAGS.map((tag) => {
              const on = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  data-tag={tag}
                  onClick={() => updateUserTesting((u) => toggleTag(u, sc.id, tag))}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer', on ? 'border-foreground bg-foreground text-background' : 'border-input bg-card hover:bg-muted')}
                >
                  {tx.tags[tag]}
                </button>
              )
            })}
          </div>
        )}
        {ut.round === 3 && (
          <>
            <span className="text-[12.5px] text-muted-foreground">
              {tx.yourTags} {tags.length ? tags.map((t) => tx.tags[t]).join(', ') : tx.noTags}
            </span>
            <Badge variant={hit ? 'ok' : 'danger'} className="ml-auto" data-testid="ut-hit" data-hit={hit}>
              {hit ? <Check /> : <X />} {hit ? tx.hit : tx.miss}
            </Badge>
            <div className="mt-1 w-full space-y-1 rounded-lg bg-subtle px-3 py-2.5 text-[13px] leading-relaxed">
              <p>
                <b className="font-semibold">{tx.cause}</b> {text.cause}
              </p>
              <p>
                <b className="font-semibold">{tx.fix}</b> <Badge variant={sc.fix === 'none' ? 'ok' : 'warn'}>{tx.fixAreas[sc.fix]}</Badge> {text.fix}
              </p>
            </div>
          </>
        )}
      </div>
    </li>
  )
}

function ResultsTable() {
  const ut = useStore((s) => s.ui.userTesting)
  const tx = useT().shell.userTesting
  const lang = useLang()
  return (
    <SectionCard icon={<ThumbsDown />} tone="ink" title={tx.tableTitle} bodyClassName="px-0 py-0" data-testid="ut-table">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-subtle font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{tx.colAnswer}</th>
              <th className="px-2 py-2 font-medium">{tx.colThumb}</th>
              <th className="px-2 py-2 font-medium">{tx.colTags}</th>
              <th className="px-4 py-2 font-medium">{tx.colFix}</th>
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((sc, i) => {
              const tags = ut.tags[sc.id] ?? []
              return (
                <tr key={sc.id} className="border-t border-hairline align-top">
                  <td className="max-w-[16rem] px-4 py-2">
                    <span className="font-mono text-muted-foreground">{i + 1}.</span> <span className="line-clamp-2">{sc.text[lang].answer}</span>
                  </td>
                  <td className="px-2 py-2"><ThumbIcon t={ut.thumbs[sc.id]} /></td>
                  <td className="px-2 py-2">{tags.length ? tags.map((t) => tx.tags[t]).join(', ') : tx.noTags}</td>
                  <td className="px-4 py-2">
                    <Badge variant={sc.fix === 'none' ? 'ok' : 'warn'}>{tx.fixAreas[sc.fix]}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}
