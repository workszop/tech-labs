import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { evaluate, heldOut, setState, setThreshold, summaryFor, useStore } from '../store'
import { Explain, Field, NextStage, Notice, Panel, ProgressBar, Range, Seg, Stat, Thumb, pct } from '../ui/common'
import { Bars, ConfusionMatrix, ScoreHistogram, ThresholdChart } from '../ui/charts'
import { getClassifier, predictions } from '../ml/session'
import { confusion, histogram, sweep } from '../ml/metrics'
import { CLASSES, STRESS_KINDS, type Sample, type StressKind } from '../types'
import { sampleUrl } from '../data/images'

type SetId = 'test' | StressKind
type Show = 'all' | 'fa' | 'fr' | 'ok'

export default function Stage5() {
  const t = useT()
  const version = useStore((s) => s.modelVersion)
  const threshold = useStore((s) => s.threshold)
  const samples = useStore((s) => s.samples)
  const progress = useStore((s) => s.progress)
  const run = useStore((s) => s.runs.find((r) => r.id === s.currentRunId))
  const seeded = useStore((s) => s.seeded)
  const [setId, setSetId] = useState<SetId>('test')
  const [show, setShow] = useState<Show>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const c = getClassifier()
  const all = useMemo(() => heldOut(), [samples])
  useEffect(() => { if (c && seeded && all.some((s) => !predictions.has(s.id))) void evaluate() }, [c, seeded, all.length, version])

  if (!c) return (<><Explain {...t.s5.explain} /><Notice tone="warn">{t.s5.noModel} <button className="link" onClick={() => setState({ stage: 4 })}>{t.nav.stages[3]}</button></Notice></>)

  const inSet = (s: Sample) => (setId === 'test' ? s.pool === 'test' : s.stress === setId)
  const rows = all.filter((s) => inSet(s) && predictions.has(s.id))
  const preds = rows.map((s) => predictions.get(s.id)!)
  const sum = summaryFor(rows, threshold)
  const test = summaryFor(all.filter((s) => s.pool === 'test'), threshold)
  const scores = preds.map((p) => p.score), defective = rows.map((s) => s.truth !== 'good')
  const kind = (s: Sample, i: number): Show => { const rej = preds[i].score >= threshold, bad = s.truth !== 'good'; return bad && !rej ? 'fa' : !bad && rej ? 'fr' : 'ok' }
  const listed = rows.map((s, i) => ({ s, k: kind(s, i), p: preds[i] })).filter((r) => show === 'all' || r.k === show)
  const open = listed.find((r) => r.s.id === openId) ?? null
  const curve = sweep(scores, defective).map((r) => ({ threshold: r.threshold, a: r.far, b: r.frr }))
  const multi = c.mode === 'advanced'
  const matrix = multi ? confusion(rows.map((s) => CLASSES.indexOf(s.truth!)), preds.map((p) => p.top), CLASSES.length) : null
  const trainAcc = run?.history.acc.at(-1), valAcc = run?.history.valAcc.at(-1)
  const setName = (k: SetId) => (k === 'test' ? t.s5.testSet : t.stress[k])
  return (
    <>
      <Explain {...t.s5.explain} />
      {progress?.key === 'evaluate' && <Notice><ProgressBar done={progress.done} total={progress.total} label={t.s5.evaluating(progress.done, progress.total)} /></Notice>}
      <Panel title={t.s5.setTitle} meta={t.s5.setMeta}>
        <div className="toolbar">
          <Seg value={setId} onChange={(v) => { setSetId(v); setOpenId(null) }} options={(['test', ...STRESS_KINDS] as SetId[]).map((k) => ({ value: k, label: setName(k) }))} />
        </div>
        <p className="muted">{setId === 'test' ? t.s5.testNote : t.stressNote[setId]}</p>
      </Panel>
      <div className="grid side">
        <div className="stack">
          <Panel title={t.s5.metricsTitle(setName(setId))} meta={sum ? t.s5.images(sum.n) : undefined}>
            {sum ? (
              <>
                <div className="stats">
                  <Stat label={t.terms.accuracy} value={pct(sum.accuracy)} hint={t.s5.hintAccuracy} />
                  <Stat label={t.terms.precision} value={pct(sum.precision)} hint={t.s5.hintPrecision} />
                  <Stat label={t.terms.recall} value={pct(sum.recall)} hint={t.s5.hintRecall} />
                  <Stat label="F1" value={pct(sum.f1)} hint={t.s5.hintF1} />
                  <Stat label={t.terms.far} value={pct(sum.far)} tone={sum.fn ? 'bad' : 'good'} hint={t.s5.hintFar(sum.fn, sum.defective)} />
                  <Stat label={t.terms.frr} value={pct(sum.frr)} tone={sum.fp ? 'warn' : 'good'} hint={t.s5.hintFrr(sum.fp, sum.good)} />
                  <Stat label={t.terms.confidence} value={pct(sum.meanConfidence)} hint={t.s5.hintConfidence} />
                  {sum.classAccuracy !== undefined && <Stat label={t.s5.classAccuracy} value={pct(sum.classAccuracy)} hint={t.s5.hintClassAccuracy} />}
                </div>
                <h4>{t.s5.matrixTitle}</h4>
                <table className="cm2">
                  <thead><tr><th /><th>{t.s5.aiAccepts}</th><th>{t.s5.aiRejects}</th></tr></thead>
                  <tbody>
                    <tr><th>{t.s5.reallyGood}</th><td className="ok"><b>{sum.tn}</b><span>{t.terms.correctAccept}</span></td><td className={sum.fp ? 'warn' : ''}><b>{sum.fp}</b><span>{t.terms.falseReject}</span></td></tr>
                    <tr><th>{t.s5.reallyDefective}</th><td className={sum.fn ? 'bad' : ''}><b>{sum.fn}</b><span>{t.terms.falseAccept}</span></td><td className="ok"><b>{sum.tp}</b><span>{t.terms.correctReject}</span></td></tr>
                  </tbody>
                </table>
                <p className="muted">{t.s5.errorsText}</p>
                {matrix && <><h4>{t.s5.matrixClasses}</h4><ConfusionMatrix matrix={matrix} labels={CLASSES.map((k) => t.clsShort[k])} actual={t.s5.actual} predicted={t.s5.predicted} /></>}
              </>
            ) : <p className="muted">{t.s5.waiting}</p>}
          </Panel>
          <Panel title={t.s5.thresholdTitle}>
            <Field label={t.s5.threshold} value={threshold.toFixed(2)} hint={t.s5.thresholdHint}><Range value={threshold} min={0.02} max={0.98} step={0.01} onChange={setThreshold} /></Field>
            <ThresholdChart rows={curve} a={t.terms.far} b={t.terms.frr} threshold={threshold} xLabel={t.s5.threshold} />
            <h4>{t.s5.scoresTitle}</h4>
            <ScoreHistogram counts={histogram(scores.filter((_, i) => !defective[i]), 25)} threshold={threshold} label={t.s5.scoresGood} tone="good" unit={t.s5.unitImages} />
            <ScoreHistogram counts={histogram(scores.filter((_, i) => defective[i]), 25)} threshold={threshold} label={t.s5.scoresDefective} tone="bad" unit={t.s5.unitImages} />
            <p className="muted">{t.s5.scoresText}</p>
          </Panel>
        </div>
        <div className="stack">
          <Panel title={t.s5.browseTitle} meta={`${listed.length}`}>
            <div className="toolbar"><Seg value={show} onChange={setShow} options={(['all', 'fa', 'fr', 'ok'] as Show[]).map((k) => ({ value: k, label: t.s5.show[k] }))} /></div>
            {open && (
              <div className="inspect">
                <img src={sampleUrl(open.s)} alt="" />
                <dl>
                  <dt>{t.s5.actual}</dt><dd>{t.cls[open.s.truth!]}</dd>
                  <dt>{t.s5.predicted}</dt><dd>{t.cls[c.classes[open.p.top]]} ({pct(open.p.confidence, 0)})</dd>
                  <dt>{t.s5.defectScore}</dt><dd>{open.p.score.toFixed(2)} {open.p.score >= threshold ? '≥' : '<'} {threshold.toFixed(2)} → {open.p.score >= threshold ? t.common.reject : t.common.accept}</dd>
                  <dt>{t.s5.verdict}</dt><dd className={open.k === 'ok' ? 'tgood' : 'tbad'}>{open.k === 'ok' ? t.s5.correct : open.k === 'fa' ? t.terms.falseAccept : t.terms.falseReject}</dd>
                </dl>
                <Bars max={1} rows={c.classes.map((k, i) => ({ label: t.clsShort[k], value: open.p.probs[i], note: pct(open.p.probs[i], 0), tone: k === 'good' ? 'good' as const : 'bad' as const }))} />
              </div>
            )}
            <div className="thumbs scroll">
              {listed.map(({ s, k, p }) => <Thumb key={s.id} s={s} tone={k === 'ok' ? 'good' : k === 'fa' ? 'bad' : 'warn'} selected={openId === s.id} onClick={() => setOpenId(s.id)} badge={p.score.toFixed(2)} />)}
              {!listed.length && <p className="muted">{t.s2.nothing}</p>}
            </div>
          </Panel>
          <Panel title={t.s5.stressTitle} meta={t.s5.stressMeta}>
            <Bars max={1} rows={[
              ...(trainAcc !== undefined ? [{ label: t.s5.accTrain, value: trainAcc, note: pct(trainAcc), tone: 'muted' as const }] : []),
              ...(valAcc !== undefined && Number.isFinite(valAcc) ? [{ label: t.s5.accVal, value: valAcc, note: pct(valAcc), tone: 'muted' as const }] : []),
              ...(test ? [{ label: t.s5.testSet, value: test.accuracy, note: pct(test.accuracy), tone: 'b' as const }] : []),
              ...STRESS_KINDS.map((k) => { const s = summaryFor(all.filter((x) => x.stress === k), threshold); return { label: t.stress[k], value: s?.accuracy ?? 0, note: s ? pct(s.accuracy) : '–', tone: 'b' as const } }),
            ]} />
            <p className="muted">{t.s5.stressText}</p>
          </Panel>
          <Panel title={t.s5.conceptsTitle}>
            <dl className="concepts">
              <dt>{t.s5.overfitting}</dt><dd>{t.s5.overfittingText(pct(trainAcc), pct(test?.accuracy))}</dd>
              <dt>{t.s5.generalization}</dt><dd>{t.s5.generalizationText}</dd>
              <dt>{t.s5.shift}</dt><dd>{t.s5.shiftText}</dd>
            </dl>
          </Panel>
        </div>
      </div>
      <NextStage to={6} label={t.nav.next(t.nav.stages[5])} />
    </>
  )
}
