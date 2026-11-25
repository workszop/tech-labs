import { useT } from '../i18n'
import { heldOut, setState, useStore } from '../store'
import { Explain, Field, NextStage, Notice, Num, Panel, Seg, Stat, pct } from '../ui/common'
import { Bars } from '../ui/charts'
import { RATES_MANUAL, RATES_NONE, ratesFromLine, ratesFromScores, scenario, type Human } from '../business'
import { getClassifier, predictions } from '../ml/session'
import type { BusinessConfig } from '../types'

export default function Stage7() {
  const t = useT()
  const cfg = useStore((s) => s.business)
  const stats = useStore((s) => s.lineStats)
  const manual = useStore((s) => s.manual)
  const threshold = useStore((s) => s.threshold)
  const line = useStore((s) => s.line)
  const run = useStore((s) => s.runs.find((r) => r.id === s.currentRunId))
  useStore((s) => s.modelVersion)
  const set = (p: Partial<BusinessConfig>) => setState((s) => ({ business: { ...s.business, ...p } }))
  const c = getClassifier()
  const test = heldOut().filter((s) => s.pool === 'test' && predictions.has(s.id))
  const lineEnough = stats.inspected >= 30
  const source = cfg.source === 'line' && lineEnough ? 'line' : 'test'
  const scores = test.map((s) => predictions.get(s.id)!.score), bad = test.map((s) => s.truth !== 'good')
  const reviewed = stats.reviewGood + stats.reviewDefective
  // A line session with the human station on says nothing about "AI alone", so that column is then left out.
  const rAi = source === 'line' ? (reviewed ? { ...RATES_NONE, n: 0 } : ratesFromLine(stats)) : ratesFromScores(scores, bad, threshold, 0, false)
  const rHuman = source === 'line' ? ratesFromLine(stats) : ratesFromScores(scores, bad, threshold, line.band, true)
  // a person: measured in Stage 1, otherwise an assumption
  const human: Human = manual ? { far: manual.defective ? manual.falseAccept / manual.defective : 0, frr: manual.good ? manual.falseReject / manual.good : 0 } : { far: 0.1, frr: 0.05 }
  const rows = [
    { key: 'none', name: t.s7.scNone, s: scenario(cfg, RATES_NONE, human) },
    { key: 'manual', name: t.s7.scManual, s: scenario(cfg, RATES_MANUAL, human) },
    ...(c && rAi.n ? [{ key: 'ai', name: t.s7.scAi, s: scenario(cfg, rAi, human) }] : []),
    ...(c && rHuman.n && (source === 'test' || reviewed > 0) ? [{ key: 'hybrid', name: t.s7.scHybrid, s: scenario(cfg, rHuman, human) }] : []),
  ]
  const money = (v: number) => `${Math.round(v).toLocaleString(t.locale)} zł`
  const n0 = (v: number) => Math.round(v).toLocaleString(t.locale)
  const manualRow = rows.find((r) => r.key === 'manual')!, ai = rows.find((r) => r.key === 'ai')
  const best = rows.reduce((a, b) => (b.s.total < a.s.total ? b : a))
  const inspectors = manual ? (cfg.dailyVolume * (manual.avgMs / 1000)) / (7 * 3600) : null
  const escaped = stats.fn + stats.uninspectedDefective
  const num = (k: keyof BusinessConfig, label: string, step = 1, unit = '') => <Field label={label}><div className="unit"><Num value={cfg[k] as number} step={step} onChange={(v) => set({ [k]: v })} />{unit && <span>{unit}</span>}</div></Field>
  return (
    <>
      <Explain {...t.s7.explain} />
      <Panel title={t.s7.measuredTitle} meta={<span className="tag on">{t.s7.tagMeasured}</span>}>
        <h4>{t.s7.fromLine}</h4>
        <div className="stats">
          <Stat label={t.s6.inspected} value={stats.inspected} />
          <Stat label={t.terms.correctAccept} value={stats.tn} tone="good" />
          <Stat label={t.terms.correctReject} value={stats.tp} tone="good" />
          <Stat label={t.s6.escaped} value={escaped} tone={escaped ? 'bad' : undefined} />
          <Stat label={t.s6.wasted} value={stats.fp} tone={stats.fp ? 'warn' : undefined} />
          <Stat label={t.s6.manual} value={stats.reviewGood + stats.reviewDefective} />
          <Stat label={t.s6.inference} value={stats.inferenceCount ? `${(stats.inferenceMsSum / stats.inferenceCount).toFixed(0)} ms` : '–'} />
          <Stat label={t.s6.throughput} value={stats.activeMs > 3000 ? t.s6.perMin(Math.round(stats.inspected / (stats.activeMs / 60000))) : '–'} />
        </div>
        <h4>{t.s7.fromTest}</h4>
        <div className="stats">
          <Stat label={t.terms.accuracy} value={pct(run?.test?.accuracy)} />
          <Stat label={t.terms.far} value={pct(run?.test?.far)} />
          <Stat label={t.terms.frr} value={pct(run?.test?.frr)} />
          <Stat label={t.s7.yourManual} value={manual ? `${manual.correct} / ${manual.total}` : '–'} hint={manual ? `${(manual.avgMs / 1000).toFixed(1)} s ${t.s1.perTin}` : t.s7.noManual} />
        </div>
        {!c && <Notice tone="warn">{t.s7.noModel}</Notice>}
      </Panel>
      <div className="grid side-left">
        <Panel title={t.s7.assumptionsTitle} meta={<span className="tag">{t.s7.tagAssumption}</span>}>
          {num('dailyVolume', t.s7.volume, 1000, t.s7.unitTins)}
          {num('defectPct', t.s7.defectPct, 0.5, '%')}
          {num('productValue', t.s7.value, 0.5, 'zł')}
          {num('falseRejectCost', t.s7.rejectCost, 0.5, 'zł')}
          {num('complaintCost', t.s7.complaintCost, 10, 'zł')}
          {num('manualCost', t.s7.manualCost, 0.05, 'zł')}
          <Field label={t.s7.source} hint={!lineEnough ? t.s7.sourceHint : undefined}>
            <Seg value={source} onChange={(v) => set({ source: v })} options={[{ value: 'test', label: t.s7.sourceTest }, { value: 'line', label: t.s7.sourceLine }]} />
          </Field>
        </Panel>
        <div className="stack">
          <Panel title={t.s7.estimateTitle} meta={<span className="tag">{t.s7.tagEstimate}</span>}>
            <div className="table-wrap"><table className="table num">
              <thead><tr><th>{t.s7.perDay}</th>{rows.map((r) => <th key={r.key} className={r === best ? 'best' : ''}>{r.name}</th>)}</tr></thead>
              <tbody>
                <tr><th>{t.s7.rowEscaped}</th>{rows.map((r) => <td key={r.key}>{n0(r.s.escaped)}</td>)}</tr>
                <tr><th>{t.s7.rowFalseRejects}</th>{rows.map((r) => <td key={r.key}>{n0(r.s.falseRejects)}</td>)}</tr>
                <tr><th>{t.s7.rowManual}</th>{rows.map((r) => <td key={r.key}>{n0(r.s.manual)}</td>)}</tr>
                <tr><th>{t.s7.rowComplaints}</th>{rows.map((r) => <td key={r.key}>{money(r.s.complaints)}</td>)}</tr>
                <tr><th>{t.s7.rowRejectCost}</th>{rows.map((r) => <td key={r.key}>{money(r.s.rejectCost)}</td>)}</tr>
                <tr><th>{t.s7.rowManualCost}</th>{rows.map((r) => <td key={r.key}>{money(r.s.manualCost)}</td>)}</tr>
                <tr className="total"><th>{t.s7.rowTotal}</th>{rows.map((r) => <td key={r.key} className={r === best ? 'best' : ''}>{money(r.s.total)}</td>)}</tr>
              </tbody>
            </table></div>
            <h4>{t.s7.chartTitle}</h4>
            <Bars rows={rows.map((r) => ({ label: r.name, value: r.s.total, note: money(r.s.total), tone: r === best ? 'good' as const : 'b' as const }))} />
            {ai && <div className="stats">
              <Stat label={t.s7.vsManual} value={money((manualRow.s.total - ai.s.total) * 250)} tone={manualRow.s.total >= ai.s.total ? 'good' : 'bad'} hint={t.s7.perYear} />
              <Stat label={t.s7.escapedYear} value={n0(ai.s.escaped * 250)} hint={t.s7.perYear} />
              {inspectors !== null && <Stat label={t.s7.inspectors} value={inspectors.toFixed(1)} hint={t.s7.inspectorsHint} />}
            </div>}
            <Notice>{t.s7.disclaimer(manual ? t.s7.humanMeasured(pct(human.far, 0), pct(human.frr, 0)) : t.s7.humanAssumed)}</Notice>
          </Panel>
        </div>
      </div>
      <Notice tone="warn"><b>{t.s1.limitTitle}</b> {t.s1.limitText}</Notice>
      <NextStage to={8} label={t.nav.next(t.nav.stages[7])} />
    </>
  )
}
