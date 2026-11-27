import { Bot, Cpu, FileCode2, Gauge, MessageSquareText, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { buildChatMessages, getSystemPrompt, PROMPT_VERSION } from '@shared/prompt'
import type { ChatMode } from '@shared/api-types'
import { answerMode, answerModePatch, type AnswerMode } from '@/state/answerMode'
import { setSettings, useStore } from '@/state/store'
import { useLang, useT } from '@/i18n'
import { Explain, SEG, SectionCard, Stat, fmtNumber, fmtUsd, segItem } from '../common'

const MODES: AnswerMode[] = ['with', 'without', 'both']
const PRE = 'scroll-thin max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2.5 font-mono text-[11.5px] leading-relaxed text-foreground'

/** Part 4. Students: the prompt and the models (read-only) and the decision with / without / both. Tech: prompts, template and generation controls. */
export function GeneratorPart() {
  const view = useStore((s) => s.settings.view)
  return (
    <div data-testid="part-generator" data-view={view} className="mx-auto max-w-4xl space-y-4 p-4 sm:p-5">
      {view === 'students' ? <StudentsFace /> : <TechFace />}
    </div>
  )
}

function StudentsFace() {
  const settings = useStore((s) => s.settings)
  const caps = useStore((s) => s.auth.session?.capabilities)
  const meta = useStore((s) => s.index.meta)
  const lang = useLang()
  const tx = useT().lab.generator
  const mode = answerMode(settings)
  const promptMode: ChatMode = mode === 'without' ? 'no-rag' : 'rag'
  return (
    <>
      <SectionCard as="h2" icon={<MessageSquareText />} title={tx.decisionTitle} explain="compare">
        <div className={SEG} role="group" aria-label={tx.answerModeAria} data-testid="answer-mode" data-mode={mode}>
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={segItem(mode === m)} onClick={() => setSettings(answerModePatch(m))}>
              {tx.modes[m]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-[var(--ink-2)]">{tx.modeHints[mode]}</p>
      </SectionCard>
      <SectionCard icon={<FileCode2 />} title={tx.promptTitle} data-testid="system-prompt">
        <p className="mb-2 text-[12.5px] text-muted-foreground">{tx.promptNote(promptMode === 'rag')}</p>
        <pre className={PRE}>{getSystemPrompt(promptMode, lang)}</pre>
      </SectionCard>
      <SectionCard icon={<Cpu />} title={tx.modelsTitle} data-testid="models">
        <dl className="space-y-3">
          <div>
            <dt className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
              {tx.generatorModel} <Badge variant="solid">{caps?.chatModel ?? tx.noModel}</Badge>
            </dt>
            <dd className="mt-1 text-[12.5px] text-muted-foreground">{tx.modelHint}</dd>
          </div>
          <div>
            <dt className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
              {tx.embedderModel} <Badge variant="doc">{caps?.embeddingModel ?? meta?.model ?? tx.noModel}</Badge> <Explain topic="embedding" />
            </dt>
            <dd className="mt-1 text-[12.5px] text-muted-foreground">{tx.embedderHint}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard icon={<SlidersHorizontal />} title={tx.settingsTitle}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={tx.temperature} value={settings.temperature.toFixed(2)} />
          <Stat label={tx.maxTokens} value={tx.tokensValue(settings.maxTokens)} />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{tx.tunedInTech}</p>
      </SectionCard>
    </>
  )
}

function TechFace() {
  const s = useStore((st) => st.settings)
  const caps = useStore((st) => st.auth.session?.capabilities)
  const usage = useStore((st) => st.usage)
  const last = useStore((st) => {
    const done = Object.values(st.runs).filter((r) => r.generate.usage)
    return done.length ? done.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)) : null
  })
  const lang = useLang()
  const tx = useT().lab.generator
  const temp = caps?.temperature ?? { min: 0, max: 1, default: 0.2 }
  const out = caps?.maxOutputTokens ?? { min: 64, max: 1024, default: 500 }
  const ex = tx.sampleExcerpt
  const template = buildChatMessages({
    question: tx.sampleQuestion,
    context: [{ chunkId: ex.chunkId, documentTitle: ex.title, folder: ex.folder, text: ex.text }],
    mode: 'rag',
    lang,
  }).find((m) => m.role === 'user')?.content ?? ''
  return (
    <>
      <SectionCard as="h2" icon={<FileCode2 />} title={tx.promptsTitle} right={<span>{tx.promptVersion}: {PROMPT_VERSION}</span>} data-testid="system-prompts">
        <div className="space-y-3">
          {(['rag', 'no-rag'] as const).map((m) => (
            <div key={m}>
              <div className="mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]">{m === 'rag' ? tx.promptRag : tx.promptNoRag}</div>
              <pre className={PRE}>{getSystemPrompt(m, lang)}</pre>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard icon={<MessageSquareText />} title={tx.templateTitle} explain="context" data-testid="user-template">
        <p className="mb-2 text-[12.5px] text-muted-foreground">{tx.templateNote}</p>
        <pre className={PRE}>{template}</pre>
      </SectionCard>
      <SectionCard icon={<Bot />} tone="ink" title={tx.controlsTitle} data-testid="generation-controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.temperature}</span>
              <span className="font-mono text-xs">{s.temperature.toFixed(2)}</span>
            </div>
            <Slider min={temp.min} max={temp.max} step={0.05} value={[Math.min(temp.max, Math.max(temp.min, s.temperature))]} onValueChange={([v]) => setSettings({ temperature: v })} aria-label={tx.temperature} />
            <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.serverRange(temp.min, temp.max)}</div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.08em]">{tx.maxTokens}</span>
              <span className="font-mono text-xs">{s.maxTokens}</span>
            </div>
            <Slider min={out.min} max={out.max} step={16} value={[Math.min(out.max, Math.max(out.min, s.maxTokens))]} onValueChange={([v]) => setSettings({ maxTokens: v })} aria-label={tx.maxTokensAria} />
            <div className="mt-1 text-[11.5px] text-muted-foreground">{tx.serverRange(out.min, out.max)}</div>
          </div>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <Switch checked={s.streaming} disabled={caps ? !caps.streaming : false} onCheckedChange={(v) => setSettings({ streaming: v })} /> {tx.streaming}
          </label>
        </div>
      </SectionCard>
      <SectionCard icon={<Gauge />} title={tx.usageTitle} data-testid="generator-usage">
        {usage ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={tx.requests} value={`${fmtNumber(usage.requestsUsed)} / ${fmtNumber(usage.requestLimit)}`} />
            <Stat label={tx.tokens} value={`${fmtNumber(usage.tokensUsed)} / ${fmtNumber(usage.tokenLimit)}`} />
            <Stat label={tx.cost} value={fmtUsd(usage.estimatedCostUsd)} hint={tx.costHint} />
            <Stat label={tx.lastAnswer} value={last?.generate.usage ? tx.lastAnswerUsage(last.generate.usage.inputTokens, last.generate.usage.outputTokens) : '–'} />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">{tx.noUsage}</p>
        )}
      </SectionCard>
    </>
  )
}
