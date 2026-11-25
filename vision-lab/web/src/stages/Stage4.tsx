import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { activateClassifier, DEFAULT_TRAIN, markSaved, runTraining, setState, stopTraining, trainingSet, useStore } from '../store'
import { Check, Explain, Field, NextStage, Notice, Panel, ProgressBar, Range, Stat, Toast, pct, useToast } from '../ui/common'
import { Bars, LineChart } from '../ui/charts'
import { classIndex, classesFor, countBy, isActive, limitImages } from '../data/dataset'
import { loadable, sampleUrl } from '../data/images'
import { featuresFor } from '../ml/features'
import { predict } from '../ml/train'
import { exportClassifier, getClassifier, importClassifier, listSaved, loadClassifier, removeSaved, saveClassifier } from '../ml/session'
import type { Sample, TrainConfig } from '../types'

/** Image -> feature extraction -> classifier -> prediction, drawn with the real numbers of one image. */
function Pipeline({ sample, version }: { sample: Sample | undefined; version: number }) {
  const t = useT()
  const strip = useRef<HTMLCanvasElement>(null)
  const [probs, setProbs] = useState<number[] | null>(null)
  const c = getClassifier()
  useEffect(() => {
    let alive = true
    if (!sample) return
    void featuresFor([loadable(sample)]).then(async (m) => {
      const f = m.get(sample.id)!; if (!alive) return
      const cv = strip.current; if (cv) {
        const x = cv.getContext('2d')!, cols = 64, rows = 4, max = Math.max(...f.slice(0, cols * rows))
        for (let i = 0; i < cols * rows; i++) { const v = Math.sqrt(f[i] / max); x.fillStyle = `rgba(76,154,255,${(0.06 + v * 0.94).toFixed(3)})`; x.fillRect((i % cols) * 5, Math.floor(i / cols) * 9, 4, 8) }
      }
      const cl = getClassifier()
      if (cl) { const p = await predict(cl, [f]); if (alive) setProbs(p[0]) } else setProbs(null)
    }).catch(() => undefined)
    return () => { alive = false }
  }, [sample, version])
  return (
    <div className="pipeline">
      <div className="pipe-step"><span className="pipe-n">1</span><b>{t.s4.pipeImage}</b>{sample && <img src={sampleUrl(sample)} alt="" />}<small>224 × 224 × 3 = 150 528 {t.s4.numbers}</small></div>
      <div className="pipe-arrow">→</div>
      <div className="pipe-step"><span className="pipe-n">2</span><b>{t.s4.pipeFeatures}</b><span className="tag">{t.s4.frozen}</span><canvas ref={strip} width={320} height={36} /><small>{t.s4.pipeFeaturesNote}</small></div>
      <div className="pipe-arrow">→</div>
      <div className="pipe-step"><span className="pipe-n">3</span><b>{t.s4.pipeHead}</b><span className="tag on">{t.s4.trainable}</span><div className="net"><i /><i /><i /><i /><i /></div><small>{t.s4.pipeHeadNote}</small></div>
      <div className="pipe-arrow">→</div>
      <div className="pipe-step"><span className="pipe-n">4</span><b>{t.s4.pipePrediction}</b>
        {c && probs ? <Bars max={1} rows={c.classes.map((k, i) => ({ label: t.clsShort[k], value: probs[i], note: pct(probs[i], 0), tone: k === 'good' ? 'good' as const : 'bad' as const }))} /> : <small>{t.s4.pipeNoModel}</small>}
      </div>
    </div>
  )
}

function Models() {
  const t = useT()
  const runs = useStore((s) => s.runs)
  const currentId = useStore((s) => s.currentRunId)
  const [saved, setSaved] = useState<{ slot: string; date: Date }[]>([])
  const [toast, say] = useToast()
  const file = useRef<HTMLInputElement>(null)
  const refresh = () => void listSaved().then(setSaved)
  useEffect(refresh, [currentId])
  const current = runs.find((r) => r.id === currentId), c = getClassifier()
  const nameOf = (slot: string) => runs.find((r) => `run-${r.id}` === slot)?.name ?? slot
  return (
    <Panel title={t.s4.modelsTitle}>
      <div className="toolbar">
        <button className="btn" disabled={!c || !current} onClick={async () => { await saveClassifier(c!, `run-${current!.id}`, current!.name); markSaved(current!.id, true); refresh(); say(t.s4.saved) }}>{t.s4.save}</button>
        <button className="btn" disabled={!c} onClick={() => void exportClassifier(c!, `rybex-qc-${current?.name.replace(/\W+/g, '') || 'model'}`)}>{t.s4.export}</button>
        <button className="btn" onClick={() => file.current?.click()}>{t.s4.import}</button>
        <input ref={file} type="file" accept=".json,.bin" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) importClassifier(f).then((m) => activateClassifier(m).then(() => say(t.s4.loaded)), () => say(t.s4.importFailed)) }} />
      </div>
      <p className="muted">{t.s4.modelsNote}</p>
      {saved.length > 0 && (
        <table className="table"><tbody>{saved.map((m) => (
          <tr key={m.slot}><td><b>{nameOf(m.slot)}</b></td><td className="muted">{m.date.toLocaleString()}</td>
            <td className="right"><button className="btn small" onClick={async () => { const cl = await loadClassifier(m.slot); if (cl) { await activateClassifier(cl); say(t.s4.loaded) } }}>{t.s4.load}</button>{' '}
              <button className="btn small ghost" onClick={async () => { await removeSaved(m.slot); markSaved(m.slot.replace('run-', ''), false); refresh() }}>{t.common.delete}</button></td></tr>
        ))}</tbody></table>
      )}
      <Toast msg={toast} />
    </Panel>
  )
}

export default function Stage4() {
  const t = useT()
  const cfg = useStore((s) => s.train)
  const mode = useStore((s) => s.mode)
  const samples = useStore((s) => s.samples)
  const training = useStore((s) => s.training)
  const progress = useStore((s) => s.progress)
  const runs = useStore((s) => s.runs)
  const currentId = useStore((s) => s.currentRunId)
  const version = useStore((s) => s.modelVersion)
  const backend = useStore((s) => s.backend)
  const [error, setError] = useState<string | null>(null)
  const classes = classesFor(mode)
  const usable = trainingSet()
  const cls = (s: Sample) => classIndex(s.label, mode)!
  const used = limitImages(usable, cfg.maxImages, cfg.seed, cls)
  const counts = countBy(used, (s) => classes[cls(s)])
  const unlabelled = samples.filter((s) => isActive(s) && s.selected && classIndex(s.label, mode) === null && !s.meta.lowQuality).length
  const run = runs.find((r) => r.id === currentId)
  const set = (p: Partial<TrainConfig>) => setState((s) => ({ train: { ...s.train, ...p } }))
  const live = training?.live ?? []
  const hist = training ? { acc: live.map((e) => e.acc), valAcc: live.map((e) => e.valAcc), loss: live.map((e) => e.loss), valLoss: live.map((e) => e.valLoss) } : run?.history
  const last = training ? live.at(-1) : run ? { acc: run.history.acc.at(-1)!, valAcc: run.history.valAcc.at(-1)!, loss: run.history.loss.at(-1)!, valLoss: run.history.valLoss.at(-1)!, seconds: run.seconds, epoch: run.history.acc.length } : undefined
  const bestVal = hist && hist.valLoss.length ? hist.valLoss.indexOf(Math.min(...hist.valLoss.filter(Number.isFinite))) : -1
  const overfit = !training && hist && bestVal >= 0 && hist.valLoss.length - bestVal > 8 && hist.valLoss.at(-1)! > hist.valLoss[bestVal] * 1.15
  const start = async () => { setError(null); const e = await runTraining(); if (e) setError(e === 'needTwoClasses' ? t.s4.needTwo : e) }
  const example = samples.find((s) => s.id === 'red-train_010') ?? usable[0]
  return (
    <>
      <Explain {...t.s4.explain} />
      <Panel title={t.s4.pipeTitle} meta={backend ? t.s4.backend(backend) : undefined}><Pipeline sample={example} version={version} /></Panel>
      <div className="grid side-left">
        <div className="stack">
          <Panel title={t.s4.configTitle}>
            <Field label={t.s4.epochs} value={cfg.epochs} hint={t.s4.epochsHint}><Range value={cfg.epochs} min={5} max={300} step={5} onChange={(epochs) => set({ epochs })} disabled={!!training} /></Field>
            <Field label={t.s4.lr} hint={t.s4.lrHint}><select value={cfg.learningRate} disabled={!!training} onChange={(e) => set({ learningRate: Number(e.target.value) })}>{[0.0001, 0.0003, 0.001, 0.003, 0.01, 0.05].map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
            <Field label={t.s4.batch} hint={t.s4.batchHint}><select value={cfg.batchSize} disabled={!!training} onChange={(e) => set({ batchSize: Number(e.target.value) })}>{[4, 8, 16, 32, 64].map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
            <Field label={t.s4.split} value={`${Math.round((1 - cfg.valSplit) * 100)} / ${Math.round(cfg.valSplit * 100)}`} hint={t.s4.splitHint}><Range value={cfg.valSplit} min={0.1} max={0.4} step={0.05} onChange={(valSplit) => set({ valSplit })} disabled={!!training} /></Field>
            <Field label={t.s4.maxImages} value={cfg.maxImages === 0 || cfg.maxImages >= usable.length ? t.s4.allImages(usable.length) : cfg.maxImages} hint={t.s4.maxImagesHint}>
              <Range value={cfg.maxImages === 0 ? usable.length : Math.min(cfg.maxImages, usable.length)} min={Math.min(10, usable.length)} max={Math.max(10, usable.length)} step={1} onChange={(v) => set({ maxImages: v >= usable.length ? 0 : v })} disabled={!!training || usable.length < 11} />
            </Field>
            <Check checked={cfg.augment} onChange={(augment) => set({ augment })} disabled={!!training}>{t.s4.augment}<small>{t.s4.augmentHint}</small></Check>
            <Check checked={cfg.balance} onChange={(balance) => set({ balance })} disabled={!!training}>{t.s4.balance}<small>{t.s4.balanceHint}</small></Check>
            <button className="btn ghost" disabled={!!training} onClick={() => setState({ train: DEFAULT_TRAIN })}>{t.s4.defaults}</button>
          </Panel>
          <Panel title={t.s4.dataTitle} meta={t.s4.dataMeta(used.length)}>
            <Bars rows={classes.map((c) => ({ label: t.cls[c], value: counts[c] ?? 0, tone: c === 'good' ? 'good' as const : 'bad' as const }))} />
            {unlabelled > 0 && <Notice tone="warn">{t.s4.unlabelled(unlabelled)} <button className="link" onClick={() => setState({ stage: 3 })}>{t.nav.stages[2]}</button></Notice>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title={t.s4.trainTitle} meta={last ? t.s4.elapsed(last.seconds.toFixed(1)) : undefined}>
            <div className="toolbar">
              {!training ? <button className="btn primary big" onClick={() => void start()} disabled={used.length < 4}>{run ? t.s4.retrain : t.s4.start}</button>
                : <button className="btn bad big" onClick={stopTraining}>{t.s4.stop}</button>}
              {training && <span className="muted">{t.s4.epochOf(training.epoch, training.epochs)}</span>}
            </div>
            {error && <Notice tone="bad">{error}</Notice>}
            {progress && progress.key !== 'seed' && <ProgressBar done={progress.done} total={progress.total} label={t.s4.progress[progress.key](progress.done, progress.total)} />}
            {training && !progress && <ProgressBar done={training.epoch} total={training.epochs} />}
            <div className="stats">
              <Stat label={t.s4.trainAcc} value={pct(last?.acc)} />
              <Stat label={t.s4.valAcc} value={pct(last?.valAcc)} />
              <Stat label={t.s4.trainLoss} value={last ? last.loss.toFixed(3) : '–'} />
              <Stat label={t.s4.valLoss} value={last && Number.isFinite(last.valLoss) ? last.valLoss.toFixed(3) : '–'} />
            </div>
            <h4>{t.s4.accChart}</h4>
            <LineChart series={[{ name: t.s4.seriesTrain, values: hist?.acc ?? [] }, { name: t.s4.seriesVal, values: hist?.valAcc ?? [] }]} yMax={1} percent xLabel={t.s4.epoch} empty={t.s4.chartEmpty} />
            <h4>{t.s4.lossChart}</h4>
            <LineChart series={[{ name: t.s4.seriesTrain, values: hist?.loss ?? [] }, { name: t.s4.seriesVal, values: hist?.valLoss ?? [] }]} xLabel={t.s4.epoch} marker={overfit ? bestVal : undefined} empty={t.s4.chartEmpty} />
            {overfit && <Notice tone="warn">{t.s4.overfit(bestVal + 1)}</Notice>}
            {run && !training && <p className="muted">{t.s4.runNote(run.name, run.data.train, run.data.val, run.history.acc.length)}</p>}
          </Panel>
          <Models />
        </div>
      </div>
      <NextStage to={5} label={t.nav.next(t.nav.stages[4])} />
    </>
  )
}
