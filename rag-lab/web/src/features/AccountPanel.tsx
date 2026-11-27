import { LogOut, RotateCcw } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_SETTINGS, setState, setUi, useStore } from '@/state/store'
import { logout } from '@/state/actions'
import { useT } from '@/i18n'
import { fmtDateTime, fmtNumber, fmtUsd } from './common'

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

/** Access, usage, cost, code and session expiry, logout and "restore defaults"; opened from the header. */
export function AccountPanel() {
  const open = useStore((s) => s.ui.accountOpen)
  const session = useStore((s) => s.auth.session)
  const usage = useStore((s) => s.usage)
  const tx = useT().shell.account
  const close = () => setUi({ accountOpen: false })
  return (
    <Dialog open={open} onOpenChange={(o) => setUi({ accountOpen: o })}>
      <DialogContent data-testid="account-panel">
        <DialogHeader>
          <DialogTitle>{tx.title}</DialogTitle>
          <DialogDescription>{tx.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="divide-y divide-hairline">
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
            {session && (
              <Row label={tx.logout} hint={tx.logoutHint}>
                <Button size="xs" variant="outline" onClick={() => { close(); void logout() }}><LogOut /> {tx.logout}</Button>
              </Row>
            )}
            <Row label={tx.restoreDefaults} hint={tx.restoreDefaultsHint}>
              {/* Language and view stay: the language switch also clears the index, and only the user flips the view. */}
              <Button size="xs" variant="outline" onClick={() => setState((s) => ({ settings: { ...DEFAULT_SETTINGS, lang: s.settings.lang, view: s.settings.view } }))} data-testid="restore-defaults">
                <RotateCcw /> {tx.restoreDefaults}
              </Button>
            </Row>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
