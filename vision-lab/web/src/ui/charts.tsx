// Small SVG charts. One y-scale per chart, 2px lines, legend plus direct end labels,
// crosshair with tooltip, values in text ink (colour only on the marks).
import { useRef, useState, type ReactNode } from 'react'

export const SERIES = ['#4c9aff', '#d98628'] as const
export interface Series { name: string; values: number[] }

const W = 560, PAD = { l: 44, r: 16, t: 10, b: 34 }

export function LineChart({ series, height = 190, yMax, yMin = 0, percent = false, xLabel, marker, empty }: {
  series: Series[]; height?: number; yMax?: number; yMin?: number; percent?: boolean; xLabel: string; marker?: number; empty?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const n = Math.max(1, ...series.map((s) => s.values.length))
  const finite = series.flatMap((s) => s.values).filter(Number.isFinite)
  const max = yMax ?? Math.max(0.0001, ...finite) * 1.08
  const iw = W - PAD.l - PAD.r, ih = height - PAD.t - PAD.b
  const X = (i: number) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const Y = (v: number) => PAD.t + ih - ((Math.min(max, Math.max(yMin, v)) - yMin) / (max - yMin)) * ih
  const fmt = (v: number) => (percent ? `${(v * 100).toFixed(1)}%` : v.toFixed(3))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (max - yMin))
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / iw) * (n - 1)))))
  }
  const has = finite.length > 0
  return (
    <div className="chart">
      <div className="legend">{series.map((s, i) => <span key={s.name}><i style={{ background: SERIES[i] }} />{s.name}</span>)}</div>
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} role="img" onPointerMove={has ? onMove : undefined} onPointerLeave={() => setHover(null)}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="tick">{percent ? `${Math.round(v * 100)}%` : v.toFixed(2)}</text>
          </g>
        ))}
        <text x={PAD.l + iw / 2} y={height - 4} textAnchor="middle" className="tick">{xLabel}</text>
        {has && [1, Math.ceil(n / 2), n].filter((v, i, a) => a.indexOf(v) === i && v <= n).map((e) => <text key={e} x={X(e - 1)} y={height - 20} textAnchor="middle" className="tick">{e}</text>)}
        {!has && empty && <text x={PAD.l + iw / 2} y={PAD.t + ih / 2} textAnchor="middle" className="tick">{empty}</text>}
        {marker !== undefined && has && <line x1={X(marker)} x2={X(marker)} y1={PAD.t} y2={PAD.t + ih} className="marker" />}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null)).filter(Boolean)
          return pts.length > 1 ? <polyline key={s.name} points={pts.join(' ')} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" />
            : pts.length === 1 ? <circle key={s.name} cx={X(0)} cy={Y(s.values[0])} r={4} fill={SERIES[si]} /> : null
        })}
        {hover !== null && has && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={PAD.t + ih} className="cross" />
            {series.map((s, si) => Number.isFinite(s.values[hover]) && <circle key={si} cx={X(hover)} cy={Y(s.values[hover])} r={4.5} fill={SERIES[si]} stroke="var(--surface)" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && has && (
        <div className="tip" style={{ left: `${(X(hover) / W) * 100}%` }}>
          <b>{xLabel} {hover + 1}</b>
          {series.map((s, si) => Number.isFinite(s.values[hover]) && <span key={si}><i style={{ background: SERIES[si] }} />{s.name}: {fmt(s.values[hover])}</span>)}
        </div>
      )}
    </div>
  )
}

/** Two measures of the same unit (%) against the decision threshold, with the current threshold marked. */
export function ThresholdChart({ rows, a, b, threshold, xLabel, height = 190 }: {
  rows: { threshold: number; a: number; b: number }[]; a: string; b: string; threshold: number; xLabel: string; height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const iw = W - PAD.l - PAD.r, ih = height - PAD.t - PAD.b
  const X = (t: number) => PAD.l + t * iw, Y = (v: number) => PAD.t + ih - v * ih
  const line = (k: 'a' | 'b') => rows.map((r) => `${X(r.threshold).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(' ')
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(); const t = (((e.clientX - r.left) / r.width) * W - PAD.l) / iw
    let best = 0; rows.forEach((row, i) => { if (Math.abs(row.threshold - t) < Math.abs(rows[best].threshold - t)) best = i }); setHover(best)
  }
  const h = hover !== null ? rows[hover] : null
  return (
    <div className="chart">
      <div className="legend"><span><i style={{ background: SERIES[0] }} />{a}</span><span><i style={{ background: SERIES[1] }} />{b}</span></div>
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} role="img" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} className="grid" /><text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="tick">{v * 100}%</text>
            <text x={X(v)} y={height - 20} textAnchor="middle" className="tick">{v.toFixed(2)}</text></g>
        ))}
        <text x={PAD.l + iw / 2} y={height - 5} textAnchor="middle" className="tick">{xLabel}</text>
        <polyline points={line('a')} fill="none" stroke={SERIES[0]} strokeWidth={2} /><polyline points={line('b')} fill="none" stroke={SERIES[1]} strokeWidth={2} />
        <line x1={X(threshold)} x2={X(threshold)} y1={PAD.t} y2={PAD.t + ih} className="marker" />
        {h && <g><line x1={X(h.threshold)} x2={X(h.threshold)} y1={PAD.t} y2={PAD.t + ih} className="cross" />
          <circle cx={X(h.threshold)} cy={Y(h.a)} r={4.5} fill={SERIES[0]} stroke="var(--surface)" strokeWidth={2} /><circle cx={X(h.threshold)} cy={Y(h.b)} r={4.5} fill={SERIES[1]} stroke="var(--surface)" strokeWidth={2} /></g>}
      </svg>
      {h && <div className="tip" style={{ left: `${(X(h.threshold) / W) * 100}%` }}><b>{xLabel} {h.threshold.toFixed(2)}</b>
        <span><i style={{ background: SERIES[0] }} />{a}: {(h.a * 100).toFixed(1)}%</span><span><i style={{ background: SERIES[1] }} />{b}: {(h.b * 100).toFixed(1)}%</span></div>}
    </div>
  )
}

/** Score distribution of one group of products, with the threshold line. */
export function ScoreHistogram({ counts, threshold, label, tone, unit }: { counts: number[]; threshold: number; label: string; tone: 'good' | 'bad'; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...counts), H = 74, bw = (W - PAD.l - PAD.r) / counts.length
  return (
    <div className="chart">
      <div className="legend"><span><i className={`sw ${tone}`} />{label}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" onPointerLeave={() => setHover(null)}>
        <line x1={PAD.l} x2={W - PAD.r} y1={H - 14} y2={H - 14} className="grid" />
        {counts.map((c, i) => {
          const h = (c / max) * (H - 22)
          return <g key={i} onPointerEnter={() => setHover(i)}>
            <rect x={PAD.l + i * bw} y={0} width={bw} height={H - 14} fill="transparent" />
            {c > 0 && <rect x={PAD.l + i * bw + 1} y={H - 14 - h} width={bw - 2} height={h} rx={2} className={`bar ${tone}`} opacity={hover === null || hover === i ? 1 : 0.55} />}
          </g>
        })}
        <line x1={PAD.l + threshold * (W - PAD.l - PAD.r)} x2={PAD.l + threshold * (W - PAD.l - PAD.r)} y1={0} y2={H - 14} className="marker" />
        <text x={PAD.l} y={H - 2} className="tick">0</text><text x={W - PAD.r} y={H - 2} textAnchor="end" className="tick">1</text>
      </svg>
      {hover !== null && <div className="tip" style={{ left: `${((PAD.l + (hover + 0.5) * bw) / W) * 100}%` }}><b>{(hover / counts.length).toFixed(2)}–{((hover + 1) / counts.length).toFixed(2)}</b><span>{counts[hover]} {unit}</span></div>}
    </div>
  )
}

/** Horizontal bars for counts per category. */
export function Bars({ rows, max, unit }: { rows: { label: ReactNode; value: number; tone?: 'good' | 'bad' | 'warn' | 'muted' | 'b' ; note?: ReactNode }[]; max?: number; unit?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="bars">
      {rows.map((r, i) => (
        <div className="bar-row" key={i} title={`${r.value}${unit ? ' ' + unit : ''}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><span className={`bar-fill ${r.tone ?? ''}`} style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / m) * 100)}%` }} /></span>
          <span className="bar-value">{r.note ?? r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** matrix[actual][predicted]; one hue, darker = more images; wrong cells get a red outline. */
export function ConfusionMatrix({ matrix, labels, actual, predicted }: { matrix: number[][]; labels: string[]; actual: string; predicted: string }) {
  const max = Math.max(1, ...matrix.flat())
  return (
    <div className="cm-wrap">
      <table className="cm">
        <thead><tr><th className="cm-corner">{actual} ↓ / {predicted} →</th>{labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>{matrix.map((row, i) => (
          <tr key={i}><th>{labels[i]}</th>{row.map((v, j) => (
            <td key={j} className={i === j ? 'ok' : v ? 'err' : ''} style={{ background: `rgba(76,154,255,${v ? 0.12 + (v / max) * 0.6 : 0})` }} title={`${labels[i]} → ${labels[j]}: ${v}`}>{v}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  )
}
