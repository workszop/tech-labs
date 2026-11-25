import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { addNoise, autoLabel, restoreLabels, setLabel, setMode, useStore } from '../store'
import { Explain, Field, NextStage, Notice, Panel, ProgressBar, Range, Seg, Thumb } from '../ui/common'
import { Bars } from '../ui/charts'
import { classIndex, classesFor, countBy, imbalance, isActive, isWrong } from '../data/dataset'
import { sampleUrl } from '../data/images'
import type { Label } from '../types'

export default function Stage3() {
  const t = useT()
  const samples = useStore((s) => s.samples)
  const mode = useStore((s) => s.mode)
  const classes = classesFor(mode)
  const pool = useMemo(() => samples.filter((s) => isActive(s) && s.selected), [samples])
  const todo = pool.filter((s) => classIndex(s.label, mode) === null)
  const done = pool.length - todo.length
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [noise, setNoise] = useState(20)
  const [audit, setAudit] = useState(false)
  const [view, setView] = useState<Label | 'todo'>('todo')
  const current = pool.find((s) => s.id === currentId) ?? todo[0] ?? null
  const wrong = pool.filter((s) => isWrong(s, mode))
  const counts = countBy(pool, (s) => { const i = classIndex(s.label, mode); return i === null ? null : classes[i] })
  const ratio = imbalance(counts)
  const assign = (label: Label) => {
    if (!current) return
    setLabel([current.id], label)
    const i = todo.findIndex((s) => s.id === current.id)
    setCurrentId(todo[i + 1]?.id ?? todo.find((s) => s.id !== current.id)?.id ?? null)
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      const n = Number(e.key); if (n >= 1 && n <= classes.length) assign(classes[n - 1])
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  })
  const listed = view === 'todo' ? todo : pool.filter((s) => { const i = classIndex(s.label, mode); return i !== null && classes[i] === view })
  return (
    <>
      <Explain {...t.s3.explain} />
      <Panel title={t.s3.modeTitle}>
        <div className="toolbar">
          <Seg value={mode} onChange={setMode} options={[{ value: 'basic', label: t.s3.basic }, { value: 'advanced', label: t.s3.advanced }]} />
          <span className="muted">{mode === 'basic' ? t.s3.basicHint : t.s3.advancedHint}</span>
        </div>
      </Panel>
      <div className="grid side">
        <Panel title={t.s3.annotateTitle} meta={`${done} / ${pool.length}`}>
          <ProgressBar done={done} total={Math.max(1, pool.length)} />
          {current ? (
            <div className="annotate">
              <img src={sampleUrl(current)} alt={t.s3.imageAlt} />
              <div className="annotate-side">
                <p className="muted">{current.label ? t.s3.currentLabel(t.cls[current.label]) : t.s3.noLabel}{current.truth === null && ` · ${t.s3.noReference}`}</p>
                <div className="class-buttons">
                  {classes.map((c, i) => (
                    <button key={c} className={`btn class ${c === 'good' ? 'good' : 'bad'} ${current.label === c ? 'on' : ''}`} onClick={() => assign(c)}><kbd>{i + 1}</kbd> {t.cls[c]}<small>{t.clsHint[c]}</small></button>
                  ))}
                </div>
                <div className="toolbar">
                  <button className="btn ghost" onClick={() => { const i = todo.findIndex((s) => s.id === current.id); setCurrentId(todo[(i + 1) % Math.max(1, todo.length)]?.id ?? null) }} disabled={todo.length < 2}>{t.s3.skip}</button>
                  {current.label && <button className="btn ghost" onClick={() => setLabel([current.id], null)}>{t.s3.clear}</button>}
                </div>
              </div>
            </div>
          ) : <Notice tone="good">{t.s3.allDone}</Notice>}
          {todo.length > 0 && (
            <div className="assist">
              <div><b>{t.s3.autoTitle}</b><p className="muted">{t.s3.autoText}</p></div>
              <button className="btn" onClick={autoLabel}>{t.s3.autoButton(todo.filter((s) => s.truth !== null && !s.meta.lowQuality).length)}</button>
            </div>
          )}
          <div className="toolbar">
            <Seg value={view} onChange={setView} options={[{ value: 'todo' as const, label: `${t.s3.unlabelled} ${todo.length}` }, ...classes.map((c) => ({ value: c, label: `${t.clsShort[c]} ${counts[c] ?? 0}` }))]} />
          </div>
          <div className="thumbs scroll short">
            {listed.map((s) => <Thumb key={s.id} s={s} onClick={() => setCurrentId(s.id)} tone={current?.id === s.id ? 'warn' : audit && isWrong(s, mode) ? 'bad' : undefined} badge={audit && isWrong(s, mode) ? '!' : undefined} />)}
            {!listed.length && <p className="muted">{t.s2.nothing}</p>}
          </div>
        </Panel>
        <div className="stack">
          <Panel title={t.s3.distTitle}>
            <Bars rows={classes.map((c) => ({ label: t.cls[c], value: counts[c] ?? 0, tone: c === 'good' ? 'good' as const : 'bad' as const }))} />
            {ratio >= 4 && <Notice tone="warn">{t.s3.imbalance(ratio.toFixed(1))}</Notice>}
            {classes.some((c) => !counts[c]) && done > 0 && <Notice tone="warn">{t.s3.emptyClass}</Notice>}
          </Panel>
          <Panel title={t.s3.qualityTitle} meta={`${wrong.length}`}>
            <p>{t.s3.qualityText(wrong.length, done)}</p>
            <div className="toolbar">
              <button className="btn" onClick={() => setAudit(!audit)}>{audit ? t.s3.auditHide : t.s3.auditShow}</button>
              {wrong.length > 0 && <button className="btn" onClick={restoreLabels}>{t.s3.restore}</button>}
            </div>
            {audit && wrong.length > 0 && <div className="thumbs short scroll">{wrong.map((s) => <Thumb key={s.id} s={s} tone="bad" onClick={() => setCurrentId(s.id)} badge={s.label ? t.clsShort[s.label] : ''} />)}</div>}
          </Panel>
          <Panel title={t.s3.noiseTitle}>
            <p className="muted">{t.s3.noiseText}</p>
            <Field label={t.s3.noiseShare} value={`${noise}%`}><Range value={noise} min={5} max={50} step={5} onChange={setNoise} /></Field>
            <button className="btn bad" disabled={!done} onClick={() => { addNoise(noise / 100); setAudit(true) }}>{t.s3.noiseButton(noise)}</button>
          </Panel>
        </div>
      </div>
      <NextStage to={4} label={t.nav.next(t.nav.stages[3])} />
    </>
  )
}
