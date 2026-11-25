import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { captureToDataset, emptyLineStats, getState, setLine, setState, setThreshold, snapshotLineToRun, updateLineStats, useStore } from '../store'
import { Check, Explain, Field, NextStage, Notice, Panel, Range, Seg, Stat, Toast, pct, useToast } from '../ui/common'
import { LineView, type LineHandle } from '../ui/LineView'
import type { Actuation, Outcome } from '../render/line'
import { embed } from '../ml/features'
import { predict } from '../ml/train'
import { getClassifier, toPrediction } from '../ml/session'
import { decide, type Verdict } from '../ml/metrics'
import { DESIGNS, LIGHTINGS, type ClassId, type Prediction } from '../types'

interface Rec { id: number; image: HTMLCanvasElement; url: string; pred?: Prediction; verdict?: Verdict; ms?: number; truth?: ClassId; actuation?: Actuation; human?: 'accept' | 'reject'; added?: boolean }
type Kind = 'ok' | 'fa' | 'fr' | 'review' | 'late'
const kindOf = (r: Rec): Kind => r.actuation === 'uninspected' ? 'late' : r.actuation === 'review' ? 'review' : (r.truth !== 'good') === (r.actuation === 'rejected') ? 'ok' : r.truth !== 'good' ? 'fa' : 'fr'
const TONE: Record<Kind, string> = { ok: 'good', fa: 'bad', fr: 'warn', review: 'amber', late: 'muted' }

export default function Stage6() {
  const t = useT()
  const line = useStore((s) => s.line)
  const stats = useStore((s) => s.lineStats)
  const threshold = useStore((s) => s.threshold)
  const version = useStore((s) => s.modelVersion)
  const currentRun = useStore((s) => s.runs.find((r) => r.id === s.currentRunId))
  const handle = useRef<LineHandle>(null)
  const recs = useRef(new Map<number, Rec>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [log, setLog] = useState<Rec[]>([])
  const [last, setLast] = useState<Rec | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'errors' | 'review'>('all')
  const [toast, say] = useToast()
  const c = getClassifier()
  void version

  const onCapture = useCallback((image: HTMLCanvasElement, id: number) => {
    const rec: Rec = { id, image, url: image.toDataURL('image/jpeg', 0.85) }
    recs.current.set(id, rec)
    // one processing unit: frames are analysed one after another
    chain.current = chain.current.then(async () => {
      const cl = getClassifier(); if (!cl) return
      const t0 = performance.now()
      const [f] = await embed([image])
      const [probs] = await predict(cl, [f])
      rec.ms = performance.now() - t0
      rec.pred = toPrediction(String(id), probs)
      const s = getState()
      rec.verdict = decide(rec.pred.score, s.threshold, s.line.band, s.line.human)
      handle.current?.decide(id, rec.verdict)
      updateLineStats((x) => ({ ...x, inferenceMsSum: x.inferenceMsSum + rec.ms!, inferenceCount: x.inferenceCount + 1 }))
      setLast({ ...rec })
    }).catch((e) => console.error(e))
  }, [])

  // Ground truth arrives only here, after the product has left the station: it is used for scoring, never for the decision.
  const onOutcome = useCallback((o: Outcome) => {
    const rec = recs.current.get(o.id); if (!rec) return
    rec.truth = o.truth; rec.actuation = o.actuation
    const bad = o.truth !== 'good'
    updateLineStats((x) => ({
      ...x, inspected: x.inspected + 1,
      tn: x.tn + (o.actuation === 'accepted' && !bad ? 1 : 0), fn: x.fn + (o.actuation === 'accepted' && bad ? 1 : 0),
      tp: x.tp + (o.actuation === 'rejected' && bad ? 1 : 0), fp: x.fp + (o.actuation === 'rejected' && !bad ? 1 : 0),
      reviewGood: x.reviewGood + (o.actuation === 'review' && !bad ? 1 : 0), reviewDefective: x.reviewDefective + (o.actuation === 'review' && bad ? 1 : 0),
      uninspected: x.uninspected + (o.actuation === 'uninspected' ? 1 : 0), uninspectedDefective: x.uninspectedDefective + (o.actuation === 'uninspected' && bad ? 1 : 0),
    }))
    setLog((l) => [{ ...rec }, ...l.filter((r) => r.id !== rec.id)].slice(0, 80))
    if (recs.current.size > 200) for (const k of [...recs.current.keys()].slice(0, 100)) recs.current.delete(k)
  }, [])

  useEffect(() => {
    if (!line.running || !c) return
    const id = setInterval(() => updateLineStats((x) => ({ ...x, activeMs: x.activeMs + 1000 })), 1000)
    return () => clearInterval(id)
  }, [line.running, c])
  useEffect(() => () => snapshotLineToRun(), [])

  const patch = (id: number, p: Partial<Rec>) => { const r = recs.current.get(id); if (r) Object.assign(r, p); setLog((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x))) }
  const add = async (r: Rec) => { await captureToDataset(r.image, r.truth ?? null); patch(r.id, { added: true }) }
  const errors = log.filter((r) => { const k = kindOf(r); return k === 'fa' || k === 'fr' || k === 'late' })
  const addErrors = async () => { const todo = errors.filter((r) => !r.added); for (const r of todo) await add(r); say(t.s6.added(todo.length)) }
  const shown = log.filter((r) => filter === 'all' || (filter === 'errors' ? errors.includes(r) : r.actuation === 'review'))
  const open = log.find((r) => r.id === openId) ?? null
  const queue = log.filter((r) => r.actuation === 'review' && !r.human)
  const escaped = stats.fn + stats.uninspectedDefective
  const mins = stats.activeMs / 60000
  const added = log.filter((r) => r.added).length

  return (
    <>
      <Explain {...t.s6.explain} />
      {!c && <Notice tone="warn">{t.s6.noModel} <button className="link" onClick={() => setState({ stage: 4 })}>{t.nav.stages[3]}</button></Notice>}
      <div className="grid line-layout">
        <Panel title={t.s6.lineTitle} meta={currentRun ? t.s6.modelMeta(currentRun.name) : undefined} className="flush">
          <div className="line-box tall"><LineView ref={handle} params={line} onCapture={c ? onCapture : undefined} onOutcome={onOutcome} label={t.s6.lineTitle} /></div>
          <div className="line-legend"><span><i className="dot good" />{t.s6.legendAccept}</span><span><i className="dot bad" />{t.s6.legendReject}</span><span><i className="dot amber" />{t.s6.legendReview}</span><span className="muted">{t.s6.drag}</span></div>
        </Panel>
        <div className="stack">
          <Panel title={t.s6.cameraTitle} meta={last?.ms ? `${last.ms.toFixed(0)} ms` : undefined}>
            <div className="feed">
              <div className={`feed-img ${last?.verdict ?? ''}`}>{last ? <img src={last.url} alt={t.s6.cameraTitle} /> : <span className="muted">{t.s6.noFrame}</span>}</div>
              <div className="feed-info">
                {last?.pred && c ? (
                  <>
                    <span className={`verdict ${last.verdict}`}>{last.verdict === 'accept' ? `✓ ${t.common.accept}` : last.verdict === 'reject' ? `✕ ${t.common.reject}` : `? ${t.s6.toHuman}`}</span>
                    <dl>
                      <dt>{t.s6.predicted}</dt><dd>{t.cls[c.classes[last.pred.top]]}</dd>
                      <dt>{t.terms.confidence}</dt><dd>{pct(last.pred.confidence, 0)}</dd>
                      <dt>{t.s5.defectScore}</dt><dd>{last.pred.score.toFixed(2)}</dd>
                    </dl>
                    <div className="scorebar" title={t.s5.defectScore}>
                      {line.human && <span className="band" style={{ left: `${Math.max(0, threshold - line.band) * 100}%`, width: `${(Math.min(1, threshold + line.band) - Math.max(0, threshold - line.band)) * 100}%` }} />}
                      <span className="fill" style={{ width: `${last.pred.score * 100}%` }} /><span className="thr" style={{ left: `${threshold * 100}%` }} />
                    </div>
                  </>
                ) : <p className="muted">{c ? t.s6.waiting : t.s6.noModelShort}</p>}
              </div>
            </div>
            <p className="muted">{t.s6.cameraNote}</p>
          </Panel>
          <Panel title={t.s6.controlsTitle}>
            <div className="toolbar">
              <button className="btn primary" onClick={() => setLine({ running: !line.running })}>{line.running ? `❚❚ ${t.s6.pause}` : `▶ ${t.s6.run}`}</button>
              <button className="btn ghost" onClick={() => { setState({ lineStats: emptyLineStats() }); setLog([]); recs.current.clear() }}>{t.s6.resetCounters}</button>
            </div>
            <Field label={t.s6.speed} value={t.s6.perMin(line.speed)}><Range value={line.speed} min={10} max={600} step={10} onChange={(speed) => setLine({ speed })} /></Field>
            <Field label={t.s6.defectRate} value={`${line.defectRate}%`}><Range value={line.defectRate} min={0} max={60} step={1} onChange={(defectRate) => setLine({ defectRate })} /></Field>
            <Field label={t.s2.varLighting}><Seg value={line.lighting} onChange={(lighting) => setLine({ lighting })} options={LIGHTINGS.map((l) => ({ value: l, label: t.lighting[l] }))} /></Field>
            <Field label={t.s6.camTilt} value={`${line.elevation}°`}><Range value={line.elevation} min={5} max={60} onChange={(elevation) => setLine({ elevation })} /></Field>
            <Field label={t.s6.camPan} value={`${line.pan}°`}><Range value={line.pan} min={-45} max={45} onChange={(pan) => setLine({ pan })} /></Field>
            <Field label={t.s6.products} hint={t.s6.productsHint}><div className="chips">{DESIGNS.map((d) => { const on = line.designs.includes(d); return <button key={d} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setLine({ designs: on ? (line.designs.length > 1 ? line.designs.filter((x) => x !== d) : line.designs) : [...line.designs, d] })}>{t.design[d]}</button> })}</div></Field>
            <Field label={t.s2.varOrientation} value={`±${Math.round((line.yawJitter * 180) / Math.PI)}°`}><Range value={line.yawJitter} min={0} max={1.2} step={0.05} onChange={(yawJitter) => setLine({ yawJitter })} /></Field>
            <Field label={t.s5.threshold} value={threshold.toFixed(2)}><Range value={threshold} min={0.02} max={0.98} step={0.01} onChange={setThreshold} /></Field>
            <Check checked={line.human} onChange={(human) => setLine({ human })}>{t.s6.human}<small>{t.s6.humanHint}</small></Check>
            {line.human && <Field label={t.s6.band} value={`±${line.band.toFixed(2)}`}><Range value={line.band} min={0.05} max={0.45} step={0.05} onChange={(band) => setLine({ band })} /></Field>}
          </Panel>
        </div>
      </div>
      <Panel title={t.s6.statsTitle} meta={t.s6.measured}>
        <div className="stats">
          <Stat label={t.s6.inspected} value={stats.inspected} />
          <Stat label={t.terms.correctAccept} value={stats.tn} tone="good" />
          <Stat label={t.terms.correctReject} value={stats.tp} tone="good" />
          <Stat label={t.s6.escaped} value={escaped} tone={escaped ? 'bad' : undefined} hint={t.terms.falseAccept} />
          <Stat label={t.s6.wasted} value={stats.fp} tone={stats.fp ? 'warn' : undefined} hint={t.terms.falseReject} />
          <Stat label={t.s6.manual} value={stats.reviewGood + stats.reviewDefective} />
          <Stat label={t.s6.late} value={stats.uninspected} tone={stats.uninspected ? 'bad' : undefined} hint={t.s6.lateHint} />
          <Stat label={t.s6.inference} value={stats.inferenceCount ? `${(stats.inferenceMsSum / stats.inferenceCount).toFixed(0)} ms` : '–'} />
          <Stat label={t.s6.throughput} value={mins > 0.05 ? t.s6.perMin(Math.round(stats.inspected / mins)) : '–'} />
        </div>
      </Panel>
      <div className="grid side">
        <Panel title={t.s6.logTitle} meta={t.s6.logMeta}>
          <div className="toolbar">
            <Seg value={filter} onChange={setFilter} options={[{ value: 'all', label: `${t.common.all} ${log.length}` }, { value: 'errors', label: `${t.s6.errors} ${errors.length}` }, { value: 'review', label: `${t.s6.manual} ${log.filter((r) => r.actuation === 'review').length}` }]} />
            <span className="spacer" />
            <button className="btn" disabled={!errors.some((r) => !r.added)} onClick={() => void addErrors()}>{t.s6.addErrors(errors.filter((r) => !r.added).length)}</button>
          </div>
          <div className="thumbs scroll short">
            {shown.map((r) => <button key={r.id} type="button" className={`thumb ${TONE[kindOf(r)]} ${openId === r.id ? 'sel' : ''}`} onClick={() => setOpenId(r.id)}><img src={r.url} alt="" />{r.added && <span className="badge">+</span>}</button>)}
            {!shown.length && <p className="muted">{t.s6.logEmpty}</p>}
          </div>
          {open && (
            <div className="inspect row">
              <img src={open.url} alt="" />
              <dl>
                <dt>{t.s6.predicted}</dt><dd>{open.pred && c ? `${t.cls[c.classes[open.pred.top]]} (${pct(open.pred.confidence, 0)})` : '–'}</dd>
                <dt>{t.s6.decision}</dt><dd>{open.actuation ? t.s6.actuation[open.actuation] : '–'}</dd>
                <dt>{t.s6.truth}</dt><dd>{open.truth ? t.cls[open.truth] : '–'}</dd>
                <dt>{t.s5.verdict}</dt><dd className={kindOf(open) === 'ok' ? 'tgood' : 'tbad'}>{t.s6.kind[kindOf(open)]}</dd>
              </dl>
              <button className="btn" disabled={open.added} onClick={() => void add(open).then(() => say(t.s6.added(1)))}>{open.added ? t.s6.inDataset : t.s6.addOne}</button>
            </div>
          )}
        </Panel>
        <div className="stack">
          <Panel title={t.s6.loopTitle} meta={added ? t.s6.loopMeta(added) : undefined}>
            <ol className="loop"><li>{t.s6.loop1}</li><li>{t.s6.loop2}</li><li>{t.s6.loop3}</li><li>{t.s6.loop4}</li></ol>
            <div className="toolbar"><button className="btn" onClick={() => setState({ stage: 3 })}>{t.s6.goLabel}</button><button className="btn" onClick={() => setState({ stage: 4 })}>{t.s6.goTrain}</button></div>
          </Panel>
          {line.human && (
            <Panel title={t.s6.queueTitle} meta={`${queue.length}`}>
              <p className="muted">{t.s6.queueText}</p>
              {queue.slice(0, 4).map((r) => (
                <div className="queue-item" key={r.id}>
                  <img src={r.url} alt="" />
                  <div><small className="muted">{t.s5.defectScore} {r.pred?.score.toFixed(2)}</small>
                    <div className="toolbar"><button className="btn good small" onClick={() => patch(r.id, { human: 'accept' })}>✓ {t.common.accept}</button><button className="btn bad small" onClick={() => patch(r.id, { human: 'reject' })}>✕ {t.common.reject}</button></div></div>
                </div>
              ))}
              {(() => { const d = log.filter((r) => r.human); const ok = d.filter((r) => (r.human === 'reject') === (r.truth !== 'good')).length; return d.length ? <p>{t.s6.queueScore(ok, d.length)}</p> : null })()}
            </Panel>
          )}
        </div>
      </div>
      <Toast msg={toast} />
      <NextStage to={7} label={t.nav.next(t.nav.stages[6])} />
    </>
  )
}
