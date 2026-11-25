import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { addSamples, exportDataset, importDataset, removeSamples, renderScenes, restoreRemoved, setSelected, useStore } from '../store'
import { Explain, Field, NextStage, Notice, Panel, ProgressBar, Range, Seg, Thumb, Toast, useToast } from '../ui/common'
import { Bars } from '../ui/charts'
import { BACKGROUNDS, CLASSES, DESIGNS, LIGHTINGS, type ClassId, type Sample, type Source } from '../types'
import { countBy, imbalance, isActive } from '../data/dataset'
import { DEFAULT_VARIATION, randomTin, randomView, canvasBlob, type Scene, type Variation } from '../data/seed'
import { getStudio } from '../render/studio'
import { toInput } from '../ml/features'
import { rng } from '../rng'
import { sampleUrl } from '../data/images'

type SourceFilter = 'all' | Source
type StatusFilter = 'all' | 'selected' | 'unselected' | 'removed'

function toggle<T>(list: T[], v: T): T[] { return list.includes(v) ? (list.length > 1 ? list.filter((x) => x !== v) : list) : [...list, v] }

function Generator() {
  const t = useT()
  const busy = useStore((s) => s.progress?.key === 'seed')
  const [defect, setDefect] = useState<ClassId | 'mix'>('mix')
  const [count, setCount] = useState(24)
  const [v, setV] = useState<Variation>({ ...DEFAULT_VARIATION, lightings: ['normal'], backgrounds: ['station'] })
  const [preview, setPreview] = useState<string[]>([])
  const [toast, say] = useToast()
  const pickDefect = (r: ReturnType<typeof rng>, i: number): ClassId => (defect === 'mix' ? (i % 3 === 0 ? 'good' : r.pick(CLASSES.slice(1))) : defect)
  useEffect(() => {
    const id = setTimeout(() => {
      const r = rng(99)
      setPreview([0, 1, 2, 3].map((i) => getStudio().render(randomTin(r, pickDefect(r, i + 1), v), randomView(r, v)).toDataURL('image/jpeg', 0.85)))
    }, 120)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, defect])
  const generate = async () => {
    const r = rng(Date.now() & 0xfffff), stamp = Date.now().toString(36)
    const scenes: Scene[] = Array.from({ length: count }, (_, i) => { const id = `gen-${stamp}-${i}`; return { id, group: id, pool: 'dev', tin: randomTin(r, pickDefect(r, i), v), view: randomView(r, v), selected: true } })
    await renderScenes(scenes)
    say(t.s2.generated(count))
  }
  const multi = <T extends string>(label: string, all: readonly T[], key: 'lightings' | 'backgrounds' | 'designs', names: Record<T, string>) => (
    <Field label={label}><div className="chips">{all.map((o) => { const on = (v[key] as string[]).includes(o); return <button key={o} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setV({ ...v, [key]: toggle([...new Set(v[key] as string[])], o) })}>{names[o]}</button> })}</div></Field>
  )
  return (
    <Panel title={t.s2.genTitle} meta={t.s2.genMeta}>
      <p className="muted">{t.s2.genIntro}</p>
      <div className="gen">
        <div className="gen-controls">
          <Field label={t.s2.genDefect}>
            <select value={defect} onChange={(e) => setDefect(e.target.value as ClassId | 'mix')}>
              <option value="mix">{t.s2.genMix}</option>{CLASSES.map((c) => <option key={c} value={c}>{t.cls[c]}</option>)}
            </select>
          </Field>
          <Field label={t.s2.genSeverity} value={`${Math.round(v.severity[0] * 100)}–${Math.round(v.severity[1] * 100)}%`} hint={t.s2.genSeverityHint}>
            <div className="pair"><Range value={v.severity[0]} min={0.03} max={1} step={0.01} onChange={(x) => setV({ ...v, severity: [Math.min(x, v.severity[1]), v.severity[1]] })} />
              <Range value={v.severity[1]} min={0.03} max={1} step={0.01} onChange={(x) => setV({ ...v, severity: [v.severity[0], Math.max(x, v.severity[0])] })} /></div>
          </Field>
          {multi(t.s2.varLighting, LIGHTINGS, 'lightings', t.lighting)}
          {multi(t.s2.varBackground, BACKGROUNDS, 'backgrounds', t.background)}
          {multi(t.s2.varDesign, DESIGNS, 'designs', t.design)}
          <Field label={t.s2.varAngle} value={`${v.elevation[0]}°–${v.elevation[1]}°`}>
            <div className="pair"><Range value={v.elevation[0]} min={5} max={60} onChange={(x) => setV({ ...v, elevation: [Math.min(x, v.elevation[1]), v.elevation[1]] })} />
              <Range value={v.elevation[1]} min={5} max={60} onChange={(x) => setV({ ...v, elevation: [v.elevation[0], Math.max(x, v.elevation[0])] })} /></div>
          </Field>
          <Field label={t.s2.varOrientation} value={`±${Math.round((v.yaw * 180) / Math.PI)}°`}><Range value={v.yaw} min={0} max={1.2} step={0.05} onChange={(yaw) => setV({ ...v, yaw })} /></Field>
          <Field label={t.s2.varReflections} value={`${Math.round(v.glare[1] * 100)}%`}><Range value={v.glare[1]} min={0} max={1} step={0.05} onChange={(g) => setV({ ...v, glare: [0, g] })} /></Field>
        </div>
        <div className="gen-preview">
          <div className="thumbs four">{preview.map((u, i) => <figure className="thumb" key={i}><img src={u} alt="" /></figure>)}</div>
          <Field label={t.s2.genCount} value={count}><Range value={count} min={4} max={80} step={4} onChange={setCount} /></Field>
          <button className="btn primary" disabled={busy} onClick={() => void generate()}>{t.s2.genButton(count)}</button>
          <small className="muted">{t.s2.genNote}</small>
        </div>
      </div>
      <Toast msg={toast} />
    </Panel>
  )
}

export default function Stage2() {
  const t = useT()
  const samples = useStore((s) => s.samples)
  const progress = useStore((s) => s.progress)
  const found = useStore((s) => s.lowQualityFound)
  const [src, setSrc] = useState<SourceFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, say] = useToast()
  const fileRef = useRef<HTMLInputElement>(null), dsRef = useRef<HTMLInputElement>(null)

  const dev = useMemo(() => samples.filter((s) => s.pool === 'dev'), [samples])
  const active = dev.filter(isActive), chosen = active.filter((s) => s.selected)
  const shown = dev.filter((s) => (src === 'all' || s.source === src) && (status === 'removed' ? s.removed : !s.removed && (status === 'all' || (status === 'selected') === s.selected)))
  const open = dev.find((s) => s.id === openId) ?? null
  const lowTotal = dev.filter((s) => s.meta.lowQuality).length
  const counts = countBy(chosen, (s) => s.truth ?? 'unknown')
  const sources = countBy(dev.filter((s) => !s.removed), (s) => s.source)
  const ratio = imbalance(Object.fromEntries(CLASSES.map((c) => [c, counts[c] ?? 0]).filter(([, n]) => (n as number) > 0)))

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const add: Sample[] = []
    for (const f of Array.from(files)) {
      try {
        const bmp = await createImageBitmap(f)
        const id = `upload-${Date.now().toString(36)}-${add.length}`
        add.push({ id, source: 'upload', pool: 'dev', group: id, truth: null, label: null, selected: true, removed: false, blob: canvasBlob(toInput(bmp)), meta: {}, addedAt: Date.now() })
      } catch { /* not an image: skipped */ }
    }
    addSamples(add); say(t.s2.uploaded(add.length)); setSrc('upload')
  }
  const variation = (key: 'lighting' | 'background' | 'design', names: Record<string, string>) => {
    const c = countBy(chosen, (s) => s.meta[key] ?? null)
    return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: names[k] ?? k, value: n, tone: 'b' as const }))
  }

  return (
    <>
      <Explain {...t.s2.explain} />
      {progress?.key === 'seed' && <Notice><ProgressBar done={progress.done} total={progress.total} label={t.s2.rendering(progress.done, progress.total)} /></Notice>}
      <div className="grid side">
        <Panel title={t.s2.poolTitle} meta={t.s2.poolMeta(chosen.length, active.length)}>
          <div className="toolbar">
            <Seg value={src} onChange={setSrc} options={(['all', 'photo', 'synthetic', 'line', 'upload'] as SourceFilter[]).filter((k) => k === 'all' || sources[k] || k === 'upload').map((k) => ({ value: k, label: k === 'all' ? t.common.all : `${t.source[k]} ${sources[k] ?? 0}` }))} />
            <Seg value={status} onChange={setStatus} options={(['all', 'selected', 'unselected', 'removed'] as StatusFilter[]).map((k) => ({ value: k, label: t.s2.status[k] }))} />
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => setSelected(shown.map((s) => s.id), true)}>{t.s2.selectShown}</button>
            <button className="btn" onClick={() => setSelected(shown.map((s) => s.id), false)}>{t.s2.deselectShown}</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>{t.s2.upload}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
            <span className="spacer" />
            <button className="btn ghost" onClick={() => void exportDataset()}>{t.s2.saveDataset}</button>
            <button className="btn ghost" onClick={() => dsRef.current?.click()}>{t.s2.loadDataset}</button>
            <input ref={dsRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importDataset(f).then((n) => say(t.s2.loaded(n)), () => say(t.s2.loadFailed)) }} />
          </div>
          <p className="muted">{t.s2.poolHint}</p>
          <div className="thumbs scroll">
            {shown.map((s) => <Thumb key={s.id} s={s} selected={s.selected && !s.removed} dim={!s.selected || s.removed} onClick={() => setOpenId(s.id)} badge={s.selected && !s.removed ? '✓' : undefined} tone={openId === s.id ? 'warn' : undefined} />)}
            {!shown.length && <p className="muted">{t.s2.nothing}</p>}
          </div>
        </Panel>
        <div className="stack">
          <Panel title={t.s2.inspectTitle}>
            {open ? (
              <div className="inspect">
                <img src={sampleUrl(open)} alt="" />
                <dl>
                  <dt>{t.s2.metaSource}</dt><dd>{t.source[open.source]}</dd>
                  {open.meta.design && <><dt>{t.s2.varDesign}</dt><dd>{t.design[open.meta.design]}</dd></>}
                  {open.meta.lighting && <><dt>{t.s2.varLighting}</dt><dd>{t.lighting[open.meta.lighting]}</dd></>}
                  {open.meta.background && <><dt>{t.s2.varBackground}</dt><dd>{t.background[open.meta.background]}</dd></>}
                  {open.meta.elevation !== undefined && <><dt>{t.s2.varAngle}</dt><dd>{open.meta.elevation}°</dd></>}
                  <dt>{t.s2.metaGroup}</dt><dd className="mono">{open.group}</dd>
                </dl>
                <div className="toolbar">
                  {!open.removed && <button className="btn" onClick={() => setSelected([open.id], !open.selected)}>{open.selected ? t.s2.exclude : t.s2.include}</button>}
                  {!open.removed && <button className="btn bad" onClick={() => { removeSamples([open.id]); say(open.meta.lowQuality ? t.s2.goodCatch : t.s2.removed) }}>{t.s2.remove}</button>}
                </div>
              </div>
            ) : <p className="muted">{t.s2.inspectHint}</p>}
          </Panel>
          <Panel title={t.s2.qualityTitle} meta={`${found} / ${lowTotal}`}>
            <p>{t.s2.qualityText(lowTotal)}</p>
            <ProgressBar done={found} total={Math.max(1, lowTotal)} />
            {dev.some((s) => s.removed) && <button className="btn ghost" onClick={restoreRemoved}>{t.s2.restore}</button>}
          </Panel>
          <Panel title={t.s2.distTitle} meta={t.s2.distMeta}>
            <Bars rows={CLASSES.map((c) => ({ label: t.cls[c], value: counts[c] ?? 0, tone: c === 'good' ? 'good' as const : 'bad' as const }))} />
            {ratio >= 4 && <Notice tone="warn">{t.s2.imbalance(ratio.toFixed(1))}</Notice>}
            <h4>{t.s2.varLighting}</h4><Bars rows={variation('lighting', t.lighting)} />
            <h4>{t.s2.varBackground}</h4><Bars rows={variation('background', t.background)} />
            <h4>{t.s2.varDesign}</h4><Bars rows={variation('design', t.design)} />
          </Panel>
        </div>
      </div>
      <Generator />
      <Toast msg={toast} />
      <NextStage to={3} label={t.nav.next(t.nav.stages[2])} />
    </>
  )
}
