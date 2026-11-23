import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { setUi, useStore } from '@/state/store'
import { compute } from '@/rag/compute'
import { useT } from '@/i18n'
import { useExplainers } from './explainers'
import { IconBadge } from './common'

export function LearnDialog() {
  const topic = useStore((s) => s.ui.learnTopic)
  const explainers = useExplainers()
  const ex = topic ? explainers[topic] : null
  if (!ex) return null
  return (
    <Dialog open onOpenChange={(o) => !o && setUi({ learnTopic: null })}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <IconBadge><GraduationCap /></IconBadge>
            <DialogTitle className="text-[20px]">{ex.title}</DialogTitle>
          </div>
          <DialogDescription className="mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">{ex.short}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 text-[14px] leading-relaxed text-[var(--ink-2)]">
          {ex.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {topic === 'token' && <TokenDemo />}
          {topic === 'cosine' && <CosineDemo />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function TokenDemo() {
  const tx = useT().shell.learn
  const [text, setText] = useState(tx.tokenSample)
  const [tokens, setTokens] = useState<{ id: number; text: string }[]>([])
  useEffect(() => {
    let alive = true
    compute.tokenize(text, 120).then((t) => alive && setTokens(t)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [text])
  return (
    <div className="rounded-lg border border-hairline bg-subtle p-3">
      <input className="mb-2 w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground" value={text} onChange={(e) => setText(e.target.value)} aria-label={tx.tokenInputAria} />
      <div className="flex flex-wrap gap-0.5 font-mono text-[12px] text-foreground">
        {tokens.map((t, i) => (
          <span key={i} title={tx.tokenId(t.id)} className={i % 2 ? 'rounded bg-doc-soft px-0.5' : 'rounded bg-query-soft px-0.5'}>
            {t.text.replace(/ /g, '·')}
          </span>
        ))}
      </div>
      <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">{tx.tokenStats(tokens.length, text.length)}</div>
    </div>
  )
}

function CosineDemo() {
  const tx = useT().shell.learn
  const [angle, setAngle] = useState(40)
  const rad = (angle * Math.PI) / 180
  const cx = 70
  const cy = 90
  const r = 60
  return (
    <div className="flex items-center gap-4 rounded-lg border border-hairline bg-subtle p-3">
      <svg viewBox="0 0 150 110" className="h-28 w-40 shrink-0">
        <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#177AA8" strokeWidth="3" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx + r * Math.cos(rad)} y2={cy - r * Math.sin(rad)} stroke="#7A5AC2" strokeWidth="3" strokeLinecap="round" />
        <path d={`M ${cx + 22} ${cy} A 22 22 0 0 0 ${cx + 22 * Math.cos(rad)} ${cy - 22 * Math.sin(rad)}`} fill="none" stroke="#625B53" />
      </svg>
      <div className="flex-1 text-sm text-foreground">
        <input type="range" min={0} max={180} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-foreground" aria-label={tx.angleAria} />
        <div>{tx.angleBefore(angle)}<b className="font-mono">{Math.cos(rad).toFixed(3)}</b></div>
        <div className="text-xs text-muted-foreground">{tx.cosineNote}</div>
      </div>
    </div>
  )
}
