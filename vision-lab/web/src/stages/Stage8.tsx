import { useState } from 'react'
import { useT } from '../i18n'
import { addNoise, DEFAULT_LINE, DEFAULT_TRAIN, deleteRun, exportRuns, getState, renameRun, restoreLabels, setLine, setState, useStore, type StageId } from '../store'
import { Notice, Panel, Seg, pct } from '../ui/common'
import { Bars } from '../ui/charts'
import { isActive } from '../data/dataset'
import { DESIGNS, STRESS_KINDS, type Run, type Sample } from '../types'

export const EXPERIMENT_IDS = ['few', 'imbalance', 'noise', 'lighting', 'packaging', 'epochs', 'threshold', 'speed', 'human'] as const
export type ExperimentId = (typeof EXPERIMENT_IDS)[number]

const select = (f: (s: Sample) => boolean) => setState((st) => ({ samples: st.samples.map((s) => (isActive(s) && s.selected !== f(s) ? { ...s, selected: f(s) } : s)) }))
const train = (p: Partial<typeof DEFAULT_TRAIN>) => setState((s) => ({ train: { ...s.train, ...p } }))

/** Every experiment changes exactly one thing and sends the student to the stage where it shows. */
const SETUP: Record<ExperimentId, { stage: StageId; apply(): void }> = {
  few: { stage: 4, apply: () => train({ maxImages: 20 }) },
  imbalance: { stage: 4, apply: () => { let kept = 0; select((s) => s.selected && (s.truth === 'good' || (s.truth !== null && kept++ < 6))) } },
  noise: { stage: 3, apply: () => addNoise(0.3) },
  lighting: { stage: 4, apply: () => select((s) => s.selected && s.meta.lighting === 'normal') },
  packaging: { stage: 5, apply: () => setLine({ designs: [...DESIGNS] }) },
  epochs: { stage: 4, apply: () => train({ epochs: 250, maxImages: 60 }) },
  threshold: { stage: 5, apply: () => undefined },
  speed: { stage: 6, apply: () => setLine({ speed: 600 }) },
  human: { stage: 6, apply: () => setLine({ human: true }) },
}

function restoreStandard() {
  select(() => true)
  restoreLabels()
  setState((s) => ({ train: DEFAULT_TRAIN, line: { ...DEFAULT_LINE, running: s.line.running }, experiment: null }))
}

type Metric = 'accuracy' | 'recall' | 'far' | 'frr' | 'stress'
const metricOf = (r: Run, m: Metric): number | undefined => {
  if (m === 'stress') { const v = STRESS_KINDS.map((k) => r.stress?.[k]?.accuracy).filter((x): x is number => x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined }
  return r.test?.[m]
}

export default function Stage8() {
  const t = useT()
  const runs = useStore((s) => s.runs)
  const active = useStore((s) => s.experiment)
  const currentId = useStore((s) => s.currentRunId)
  const [metric, setMetric] = useState<Metric>('accuracy')
  const start = (id: ExperimentId) => { SETUP[id].apply(); setState({ experiment: id, stage: SETUP[id].stage }); window.scrollTo(0, 0) }
  const badTone = metric === 'far' || metric === 'frr'
  return (
    <>
      <Panel title={t.s8.introTitle}>
        <p>{t.s8.intro}</p>
        <div className="toolbar">
          <button className="btn" onClick={restoreStandard}>{t.s8.restore}</button>
          {active && <span className="tag on">{t.s8.active}: {t.s8.exp[active as ExperimentId]?.name}</span>}
        </div>
      </Panel>
      <div className="exp-grid">
        {EXPERIMENT_IDS.map((id, i) => {
          const e = t.s8.exp[id], n = runs.filter((r) => r.experiment === id).length
          return (
            <article key={id} className={`exp ${active === id ? 'on' : ''}`}>
              <header><span className="pipe-n">{i + 1}</span><h3>{e.name}</h3></header>
              <p className="goal">{t.s8.goal}: <b>{e.goal}</b></p>
              <p>{e.todo}</p>
              <p className="muted">{e.watch}</p>
              <footer><button className="btn primary" onClick={() => start(id)}>{t.s8.setup}</button>{n > 0 && <span className="muted">{t.s8.runsCount(n)}</span>}</footer>
            </article>
          )
        })}
      </div>
      <Panel title={t.s8.resultsTitle} meta={`${runs.length}`}>
        {runs.length ? (
          <>
            <div className="toolbar">
              <button className="btn" onClick={() => exportRuns('json')}>{t.s8.exportJson}</button>
              <button className="btn" onClick={() => exportRuns('csv')}>{t.s8.exportCsv}</button>
            </div>
            <div className="table-wrap"><table className="table num">
              <thead><tr><th>{t.s8.colRun}</th><th>{t.s8.colExperiment}</th><th>{t.s8.colImages}</th><th>{t.s8.colWrong}</th><th>{t.s8.colEpochs}</th><th>{t.s8.colTrain}</th><th>{t.s8.colVal}</th><th>{t.s8.colTest}</th><th>{t.terms.far}</th><th>{t.terms.frr}</th><th>{t.s8.colStress}</th><th>{t.s8.colLine}</th><th /></tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.id} className={r.id === currentId ? 'current' : ''}>
                  <th><input className="name" value={r.name} aria-label={t.s8.colRun} onChange={(e) => renameRun(r.id, e.target.value)} />{r.id === currentId && <span className="tag on">{t.s8.loaded}</span>}</th>
                  <td className="left">{r.experiment ? t.s8.exp[r.experiment as ExperimentId]?.name ?? r.experiment : '–'}<br /><small className="muted">{r.mode === 'basic' ? t.s3.basic : t.s3.advanced}</small></td>
                  <td>{r.data.train}</td><td>{r.data.wrongLabels}</td><td>{r.history.acc.length}</td>
                  <td>{pct(r.history.acc.at(-1))}</td><td>{pct(r.history.valAcc.at(-1))}</td><td>{pct(r.test?.accuracy)}</td><td>{pct(r.test?.far)}</td><td>{pct(r.test?.frr)}</td>
                  <td>{pct(metricOf(r, 'stress'))}</td>
                  <td>{r.line && r.line.inspected ? `${r.line.tp + r.line.tn}/${r.line.inspected}` : '–'}</td>
                  <td>{r.id !== currentId && <button className="btn small ghost" onClick={() => { if (getState().runs.length) deleteRun(r.id) }}>{t.common.delete}</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <h4>{t.s8.compare}</h4>
            <div className="toolbar"><Seg value={metric} onChange={setMetric} options={[{ value: 'accuracy', label: t.s8.mAccuracy }, { value: 'recall', label: t.terms.recall }, { value: 'far', label: t.terms.far }, { value: 'frr', label: t.terms.frr }, { value: 'stress', label: t.s8.colStress }]} /></div>
            <Bars max={1} rows={runs.map((r) => { const v = metricOf(r, metric); return { label: `${r.name}${r.experiment ? ' · ' + (t.s8.exp[r.experiment as ExperimentId]?.name ?? '') : ''}`, value: v ?? 0, note: pct(v), tone: badTone ? 'bad' as const : 'b' as const } })} />
            <p className="muted">{t.s8.compareNote}</p>
          </>
        ) : <Notice>{t.s8.noRuns}</Notice>}
      </Panel>
    </>
  )
}
