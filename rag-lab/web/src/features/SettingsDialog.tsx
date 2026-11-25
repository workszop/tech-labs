import { LogOut, RotateCcw } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_SETTINGS, setSettings, setUi, useStore } from '@/state/store'
import { logout } from '@/state/actions'
import { useT } from '@/i18n'
import { ChunkSettings } from './IndexBuilder'
import { cn } from '@/lib/utils'
import { Explain, fmtDateTime, fmtNumber, fmtUsd } from './common'

function Row({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// Segmented toggle: borderless stone track, each option a full pill, the active one solid yellow.
const SEG = 'inline-flex gap-0.5 rounded-full bg-subtle p-[3px]'
const segItem = (on: boolean) => cn('cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors', on ? 'bg-primary text-primary-foreground' : 'text-[var(--ink-2)] hover:bg-muted hover:text-foreground')

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-3">
      <div className="mb-1 flex items-center gap-3">
        <h3 className="font-display text-[16px] font-bold">{title}</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  )
}

export function SettingsDialog() {
  const open = useStore((s) => s.ui.settingsOpen)
  const s = useStore((st) => st.settings)
  const session = useStore((st) => st.auth.session)
  const usage = useStore((st) => st.usage)
  const meta = useStore((st) => st.index.meta)
  const tx = useT().shell.settings
  const mapTx = useT().lab.map
  const caps = session?.capabilities
  const temp = caps?.temperature ?? { min: 0, max: 1, default: 0.2 }
  const out = caps?.maxOutputTokens ?? { min: 64, max: 1024, default: 500 }
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ settingsOpen: o })}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{tx.title}</DialogTitle>
          <DialogDescription>{tx.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-x-8 md:grid-cols-2">
          <div>
            <Group title={tx.embeddings}>
              <Row label={tx.embeddingModel}><Badge variant="doc">{caps?.embeddingModel ?? meta?.model ?? tx.none}</Badge></Row>
              <Row label={tx.dimensions}><span className="font-mono text-sm">{caps?.embeddingDimensions ?? meta?.dimensions ?? tx.none}</span></Row>
              <div className="py-2"><ChunkSettings compact /></div>
            </Group>
            <Group title={tx.retrieval}>
              <Row label={<span className="flex items-center gap-1">{tx.topK} <Explain topic="topk" /></span>} hint={tx.topKHint}>
                <div className="flex w-40 items-center gap-2"><Slider min={1} max={10} step={1} value={[s.topK]} onValueChange={([v]) => setSettings({ topK: v })} aria-label={tx.topK} /><span className="w-5 font-mono text-xs">{s.topK}</span></div>
              </Row>
              <Row label={tx.threshold} hint={tx.thresholdHint}>
                <div className="flex w-40 items-center gap-2">
                  <Switch checked={s.threshold !== null} onCheckedChange={(v) => setSettings({ threshold: v ? 0.3 : null })} aria-label={tx.thresholdEnableAria} />
                  {s.threshold !== null && <><Slider min={0} max={0.9} step={0.01} value={[s.threshold]} onValueChange={([v]) => setSettings({ threshold: v })} aria-label={tx.thresholdAria} /><span className="font-mono text-xs">{s.threshold.toFixed(2)}</span></>}
                </div>
              </Row>
              <Row label={tx.showAllScores}><Switch checked={s.showAllScores} onCheckedChange={(v) => setSettings({ showAllScores: v })} /></Row>
              <Row label={tx.showRetrievalDetails}><Switch checked={s.showRetrievalDetails} onCheckedChange={(v) => setSettings({ showRetrievalDetails: v })} /></Row>
            </Group>
            <Group title={tx.generation}>
              <Row label={tx.languageModel}><Badge variant="solid">{caps?.chatModel ?? tx.none}</Badge></Row>
              <Row label={tx.temperature} hint={tx.serverRange(temp.min, temp.max)}>
                <div className="flex w-40 items-center gap-2"><Slider min={temp.min} max={temp.max} step={0.05} value={[Math.min(temp.max, Math.max(temp.min, s.temperature))]} onValueChange={([v]) => setSettings({ temperature: v })} aria-label={tx.temperature} /><span className="w-8 font-mono text-xs">{s.temperature.toFixed(2)}</span></div>
              </Row>
              <Row label={tx.maxTokens} hint={tx.serverRange(out.min, out.max)}>
                <div className="flex w-40 items-center gap-2"><Slider min={out.min} max={out.max} step={16} value={[Math.min(out.max, Math.max(out.min, s.maxTokens))]} onValueChange={([v]) => setSettings({ maxTokens: v })} aria-label={tx.maxTokensAria} /><span className="w-9 font-mono text-xs">{s.maxTokens}</span></div>
              </Row>
              <Row label={tx.streaming}><Switch checked={s.streaming} disabled={caps ? !caps.streaming : false} onCheckedChange={(v) => setSettings({ streaming: v })} /></Row>
            </Group>
          </div>
          <div>
            <Group title={tx.visualization}>
              <Row label={tx.mapMode}><div className={SEG}>{(['question', '2d', '3d'] as const).map((m) => <button key={m} type="button" aria-pressed={s.vizMode === m} className={segItem(s.vizMode === m)} onClick={() => setSettings({ vizMode: m })}>{m === 'question' ? mapTx.viewQuestion : m.toUpperCase()}</button>)}</div></Row>
              <Row label={tx.colorBy}><div className={SEG}>{(['folder', 'document'] as const).map((m) => <button key={m} type="button" aria-pressed={s.colorBy === m} className={segItem(s.colorBy === m)} onClick={() => setSettings({ colorBy: m })}>{m === 'folder' ? tx.colorByFolder : tx.colorByDocument}</button>)}</div></Row>
              <Row label={tx.connections}><Switch checked={s.showConnections} onCheckedChange={(v) => setSettings({ showConnections: v })} /></Row>
              <Row label={tx.labels}><Switch checked={s.showLabels} onCheckedChange={(v) => setSettings({ showLabels: v })} /></Row>
              <Row label={tx.resetViz}><Button size="xs" variant="outline" onClick={() => { setSettings({ vizMode: 'question', colorBy: 'folder', showConnections: true, showLabels: false }); setUi({ mapFocusDoc: null, mapFolders: null }) }}><RotateCcw /> {tx.resetVizButton}</Button></Row>
            </Group>
            <Group title={tx.account}>
              <Row label={tx.access}><Badge variant={session ? 'ok' : 'warn'}>{session ? tx.accessActive(session.label) : tx.accessNone}</Badge></Row>
              {usage && (
                <>
                  <Row label={tx.requests} hint={tx.remaining(fmtNumber(Math.max(0, usage.requestLimit - usage.requestsUsed)))}><span className="font-mono text-xs">{fmtNumber(usage.requestsUsed)} / {fmtNumber(usage.requestLimit)}</span></Row>
                  <Row label={tx.tokens} hint={tx.remaining(fmtNumber(Math.max(0, usage.tokenLimit - usage.tokensUsed)))}><span className="font-mono text-xs">{fmtNumber(usage.tokensUsed)} / {fmtNumber(usage.tokenLimit)}</span></Row>
                  <Row label={tx.cost} hint={tx.costHint}><span className="font-mono text-xs">{fmtUsd(usage.estimatedCostUsd)}</span></Row>
                  {usage.codeExpiresAt && <Row label={tx.codeExpires}><span className="font-mono text-xs">{fmtDateTime(usage.codeExpiresAt)}</span></Row>}
                </>
              )}
              {session && <Row label={tx.sessionExpires}><span className="font-mono text-xs">{fmtDateTime(session.expiresAt)}</span></Row>}
              {session && <Row label={tx.session}><span className="font-mono text-xs">{session.sessionRef}</span></Row>}
              {session && <Row label={tx.logout} hint={tx.logoutHint}><Button size="xs" variant="outline" onClick={() => { setUi({ settingsOpen: false }); void logout() }}><LogOut /> {tx.logout}</Button></Row>}
            </Group>
            <div className="border-t border-dashed py-3">
              <Button size="xs" variant="outline" onClick={() => setSettings({ ...DEFAULT_SETTINGS })}>{tx.restoreDefaults}</Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
