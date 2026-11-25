import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { setState, useStore, orderKey } from '../store'
import { Explain, NextStage, Notice, Panel, Stat, pct } from '../ui/common'
import { LineView } from '../ui/LineView'
import { sampleUrl } from '../data/images'
import type { LineParams } from '../render/line'
import type { Sample } from '../types'

const DEMO: LineParams = { running: true, speed: 36, defectRate: 25, lighting: 'normal', elevation: 27, pan: 0, designs: ['szprot', 'makrela'], yawJitter: 0.3, human: false }

/** What the camera hands to a computer: a grid of numbers. */
function Pixels({ sample }: { sample: Sample | undefined }) {
  const t = useT()
  const ref = useRef<HTMLCanvasElement>(null)
  const [px, setPx] = useState<{ x: number; y: number; rgb: number[] } | null>(null)
  const N = 28
  useEffect(() => {
    if (!sample) return
    const img = new Image(); img.src = sampleUrl(sample)
    void img.decode().then(() => { const c = ref.current; if (!c) return; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, img.height * 0.1, img.width, img.width, 0, 0, N, N) })
  }, [sample])
  return (
    <div className="pixels">
      <canvas ref={ref} width={N} height={N} onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(), x = Math.min(N - 1, Math.floor(((e.clientX - r.left) / r.width) * N)), y = Math.min(N - 1, Math.floor(((e.clientY - r.top) / r.height) * N))
        setPx({ x, y, rgb: Array.from(e.currentTarget.getContext('2d')!.getImageData(x, y, 1, 1).data.slice(0, 3)) })
      }} />
      <p className="mono">{px ? `${t.s1.pixel} (${px.x}, ${px.y}) → R ${px.rgb[0]} · G ${px.rgb[1]} · B ${px.rgb[2]}` : t.s1.pixelHint}</p>
    </div>
  )
}

function Manual() {
  const t = useT()
  const samples = useStore((s) => s.samples)
  const saved = useStore((s) => s.manual)
  const items = useMemo(() => {
    const test = samples.filter((s) => s.pool === 'test' && s.source === 'photo').sort((a, b) => orderKey(a.id) - orderKey(b.id))
    const good = test.filter((s) => s.truth === 'good').slice(0, 6), bad = test.filter((s) => s.truth !== 'good').slice(0, 6)
    return [...good, ...bad].sort((a, b) => orderKey(b.id + 'x') - orderKey(a.id + 'x'))
  }, [samples])
  const [i, setI] = useState(-1)
  const [answers, setAnswers] = useState<{ reject: boolean; ms: number }[]>([])
  const shown = useRef(0)
  const answer = (reject: boolean) => {
    const next = [...answers, { reject, ms: performance.now() - shown.current }]
    setAnswers(next)
    if (next.length === items.length) {
      const bad = items.map((s) => s.truth !== 'good')
      setState({ manual: {
        total: items.length, correct: next.filter((a, k) => a.reject === bad[k]).length,
        falseAccept: next.filter((a, k) => !a.reject && bad[k]).length, falseReject: next.filter((a, k) => a.reject && !bad[k]).length,
        defective: bad.filter(Boolean).length, good: bad.filter((b) => !b).length, avgMs: next.reduce((s, a) => s + a.ms, 0) / next.length,
      } })
      setI(items.length)
    } else setI(next.length)
  }
  useEffect(() => {
    if (i < 0 || i >= items.length) return
    const key = (e: KeyboardEvent) => { if (e.key === 'a' || e.key === 'A') answer(false); if (e.key === 'r' || e.key === 'R') answer(true) }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  })
  const start = () => { setAnswers([]); setI(0) }
  const running = i >= 0 && i < items.length
  return (
    <Panel title={t.s1.manualTitle} meta={running ? `${i + 1} / ${items.length}` : undefined}>
      {!running && <p>{t.s1.manualIntro}</p>}
      {running && (
        <div className="manual">
          <img src={sampleUrl(items[i])} alt={t.s1.manualAlt} onLoad={() => { shown.current = performance.now() }} />
          <div className="manual-actions">
            <button className="btn good big" onClick={() => answer(false)}>✓ {t.common.accept} <kbd>A</kbd></button>
            <button className="btn bad big" onClick={() => answer(true)}>✕ {t.common.reject} <kbd>R</kbd></button>
          </div>
        </div>
      )}
      {!running && saved && (
        <>
          <div className="stats">
            <Stat label={t.s1.yourAccuracy} value={`${saved.correct} / ${saved.total}`} hint={pct(saved.correct / saved.total, 0)} />
            <Stat label={t.s1.yourSpeed} value={`${(saved.avgMs / 1000).toFixed(1)} s`} hint={t.s1.perTin} />
            <Stat label={t.terms.falseAccept} value={saved.falseAccept} tone={saved.falseAccept ? 'bad' : 'good'} hint={t.s1.ofDefective(saved.defective)} />
            <Stat label={t.terms.falseReject} value={saved.falseReject} tone={saved.falseReject ? 'warn' : 'good'} hint={t.s1.ofGood(saved.good)} />
          </div>
          <p className="muted">{t.s1.manualKept((3600 / (saved.avgMs / 1000)) | 0)}</p>
          {i === items.length && (
            <div className="thumbs wide">
              {items.map((s, k) => { const ok = answers[k].reject === (s.truth !== 'good'); return (
                <figure key={s.id} className={`thumb ${ok ? 'good' : 'bad'}`}><img src={sampleUrl(s)} alt="" /><span className="badge">{s.truth ? t.cls[s.truth] : ''}</span></figure>) })}
            </div>
          )}
        </>
      )}
      {!running && <button className="btn primary" onClick={start} disabled={!items.length}>{saved ? t.s1.manualAgain : t.s1.manualStart}</button>}
    </Panel>
  )
}

export default function Stage1() {
  const t = useT()
  const sample = useStore((s) => s.samples.find((x) => x.id === 'red-train_003'))
  return (
    <>
      <Explain {...t.s1.explain} />
      <div className="grid two-wide">
        <Panel title={t.s1.lineTitle} meta={t.s1.lineMeta}>
          <div className="line-box"><LineView params={DEMO} label={t.s1.lineTitle} /></div>
          <p className="muted">{t.s1.lineCaption}</p>
        </Panel>
        <Panel title={t.s1.cameraTitle}>
          <p>{t.s1.cameraText}</p>
          <Pixels sample={sample} />
          <p>{t.s1.modelText}</p>
        </Panel>
      </div>
      <div className="grid two">
        <Panel title={t.s1.rulesTitle}>
          <div className="versus">
            <div><h4>{t.s1.rulesA}</h4><p>{t.s1.rulesAText}</p><pre className="mono">{t.s1.rulesCode}</pre></div>
            <div><h4>{t.s1.rulesB}</h4><p>{t.s1.rulesBText}</p></div>
          </div>
        </Panel>
        <Panel title={t.s1.whyTitle}>
          <ul className="list">{t.s1.why.map((w) => <li key={w}>{w}</li>)}</ul>
          <Notice tone="warn"><b>{t.s1.limitTitle}</b> {t.s1.limitText}</Notice>
        </Panel>
      </div>
      <Manual />
      <NextStage to={2} label={t.nav.next(t.nav.stages[1])} />
    </>
  )
}
