import { useEffect, useState } from 'react'
import { useT } from './i18n'
import { resetLab, setState, trainingSet, useStore, type StageId } from './store'
import { classIndex } from './data/dataset'
import Stage1 from './stages/Stage1'
import Stage2 from './stages/Stage2'
import Stage3 from './stages/Stage3'
import Stage4 from './stages/Stage4'
import Stage5 from './stages/Stage5'
import Stage6 from './stages/Stage6'
import Stage7 from './stages/Stage7'
import Stage8 from './stages/Stage8'

const STAGES = [Stage1, Stage2, Stage3, Stage4, Stage5, Stage6, Stage7, Stage8]

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#0f5b5e" />
      <ellipse cx="14" cy="16" rx="9" ry="4.6" fill="#fff" /><path d="M21 16l7-5v10z" fill="#fff" /><circle cx="9.5" cy="14.8" r="1.3" fill="#0f5b5e" />
    </svg>
  )
}

export default function App() {
  const t = useT()
  const s = useStore((x) => x)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { document.documentElement.lang = s.lang; document.title = t.app.title }, [s.lang, t])
  if (!s.ready) return <div className="boot">{t.app.loading}</div>
  if (s.error) return <div className="boot"><p>{t.app.error}</p><pre>{s.error}</pre><button className="btn" onClick={() => void resetLab()}>{t.app.reset}</button></div>
  const Stage = STAGES[s.stage - 1]
  const run = s.runs.find((r) => r.id === s.currentRunId)
  const usable = trainingSet(s)
  const labelPool = s.samples.filter((x) => x.pool === 'dev' && !x.removed && x.selected)
  const done: Record<number, boolean> = {
    1: !!s.manual, 2: s.seeded && s.lowQualityFound > 0, 3: labelPool.length > 0 && labelPool.filter((x) => !x.meta.lowQuality && x.truth !== null).every((x) => classIndex(x.label, s.mode) !== null),
    4: !!run, 5: !!run?.test, 6: s.lineStats.inspected > 0 && !!run, 7: false, 8: s.runs.length > 1,
  }
  const go = (stage: StageId) => { setState({ stage }); window.scrollTo(0, 0) }
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Logo /><span><b>RYBEX</b> Vision Lab</span></div>
        <div className="status">
          <span className="chip-status" title={t.app.statusData}>{t.app.images(usable.length)}</span>
          <span className={`chip-status ${run ? 'ok' : ''}`} title={t.app.statusModel}>{run ? t.app.model(run.name, run.mode === 'basic' ? t.s3.basic : t.s3.advanced) : t.app.noModel}</span>
          {s.backend && <span className="chip-status" title={t.app.statusBackend}>{s.backend === 'webgl' ? 'GPU (WebGL)' : 'CPU'}</span>}
        </div>
        <div className="top-actions">
          <div className="seg small" role="group" aria-label={t.app.language}>
            {(['pl', 'en'] as const).map((l) => <button key={l} className={s.lang === l ? 'on' : ''} aria-pressed={s.lang === l} onClick={() => setState({ lang: l })}>{l.toUpperCase()}</button>)}
          </div>
          <button className="btn ghost small" onClick={() => setConfirm(true)}>{t.app.reset}</button>
        </div>
      </header>
      <div className="shell">
        <nav className="side" aria-label={t.app.stages}>
          {t.nav.stages.map((name, i) => (
            <button key={i} className={`side-item ${s.stage === i + 1 ? 'on' : ''}`} aria-current={s.stage === i + 1 ? 'step' : undefined} onClick={() => go((i + 1) as StageId)}>
              <span className={`side-n ${done[i + 1] ? 'done' : ''}`}>{done[i + 1] ? '✓' : i === 7 ? '⚗' : i + 1}</span>
              <span className="side-text"><b>{name}</b><small>{t.nav.subtitles[i]}</small></span>
            </button>
          ))}
          <p className="side-foot">{t.app.local}</p>
        </nav>
        <main className="main">
          <div className="stage-head">
            <span className="eyebrow">{s.stage <= 7 ? t.app.stageOf(s.stage, 7) : t.app.extra}</span>
            <h1>{t.nav.stages[s.stage - 1]}</h1>
            <p>{t.nav.leads[s.stage - 1]}</p>
          </div>
          <Stage key={s.stage} />
        </main>
      </div>
      {confirm && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setConfirm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{t.app.resetTitle}</h3><p>{t.app.resetText}</p>
            <div className="toolbar"><button className="btn bad" onClick={() => void resetLab()}>{t.app.resetYes}</button><button className="btn" onClick={() => setConfirm(false)}>{t.app.cancel}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
