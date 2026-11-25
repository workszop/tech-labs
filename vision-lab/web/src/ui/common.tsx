import { useEffect, useState, type ReactNode } from 'react'
import type { Sample } from '../types'
import { sampleUrl } from '../data/images'
import { useT } from '../i18n'
import { setState, useStore, type StageId } from '../store'

/** The four questions every stage answers. */
export function Explain({ what, why, how, wrong }: { what: string; why: string; how: string; wrong: string }) {
  const t = useT()
  return (
    <div className="explain">
      <div><h4>{t.explain.what}</h4><p>{what}</p></div>
      <div><h4>{t.explain.why}</h4><p>{why}</p></div>
      <div><h4>{t.explain.how}</h4><p>{how}</p></div>
      <div className="wrong"><h4>{t.explain.wrong}</h4><p>{wrong}</p></div>
    </div>
  )
}

export function Panel({ title, meta, children, className = '' }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <header><h3>{title}</h3>{meta && <span className="meta">{meta}</span>}</header>}
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn'; hint?: string }) {
  return <div className={`stat ${tone ?? ''}`} title={hint}><span className="stat-label">{label}</span><span className="stat-value">{value}</span>{hint && <span className="stat-hint">{hint}</span>}</div>
}

export function Field({ label, hint, children, value }: { label: string; hint?: string; children: ReactNode; value?: ReactNode }) {
  return <label className="field"><span className="field-top"><span>{label}</span>{value !== undefined && <b>{value}</b>}</span>{children}{hint && <small>{hint}</small>}</label>
}
export function Range({ value, min, max, step = 1, onChange, disabled }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return <input type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
}
export function Num({ value, min = 0, step = 1, onChange }: { value: number; min?: number; step?: number; onChange: (v: number) => void }) {
  return <input type="number" value={value} min={min} step={step} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= min) onChange(v) }} />
}
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="seg" role="group">{options.map((o) => <button key={o.value} type="button" className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>
}
export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return <label className="check"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>
}

export function Thumb({ s, badge, tone, selected, onClick, dim, title }: { s: Sample; badge?: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'muted'; selected?: boolean; onClick?: (e: React.MouseEvent) => void; dim?: boolean; title?: string }) {
  return (
    <button type="button" className={`thumb ${tone ?? ''} ${selected ? 'sel' : ''} ${dim ? 'dim' : ''}`} onClick={onClick} title={title ?? s.id}>
      <img src={sampleUrl(s)} alt="" loading="lazy" />
      {badge && <span className="badge">{badge}</span>}
    </button>
  )
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  return <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemax={total}><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />{label && <em>{label}</em>}</div>
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode }) {
  return <div className={`notice ${tone}`}>{children}</div>
}

export function NextStage({ to, label }: { to: StageId; label: string }) {
  return <div className="next"><button className="btn primary" onClick={() => { setState({ stage: to }); window.scrollTo(0, 0) }}>{label} →</button></div>
}

export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 3200); return () => clearTimeout(id) }, [msg])
  return [msg, setMsg]
}
export function Toast({ msg }: { msg: string | null }) { return msg ? <div className="toast" role="status">{msg}</div> : null }

export const pct = (v: number | undefined, digits = 1) => (v === undefined || Number.isNaN(v) ? '–' : `${(v * 100).toFixed(digits)}%`)

/** True once the synthetic starter images exist. */
export const useSeeded = () => useStore((s) => s.seeded)
