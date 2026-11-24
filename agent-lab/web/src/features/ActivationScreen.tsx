import { useState } from 'react'
import { ArrowRight, BookOpen, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, API_BASE_URL } from '@/api/client'
import { activate, browseWithoutActivation } from '@/state/actions'
import { useStore } from '@/state/store'
import { t, useT } from '@/i18n'
import { Logo } from './Logo'
import { LangSwitch } from './LangSwitch'
import { IconBadge } from './common'

/** What went wrong, kept as data so the message follows a later language switch. */
type ActivationError = { code: string; fallback: string; retryAfterSeconds?: number }

function errorText(err: ActivationError, tx: ReturnType<typeof t>['shell']['activation']): string {
  if (err.code === 'rate_limited') return tx.rateLimited(err.retryAfterSeconds ? Math.ceil(err.retryAfterSeconds / 60) : null)
  return tx.errors[err.code] ?? err.fallback
}

export function ActivationScreen() {
  const notice = useStore((s) => s.auth.notice)
  const tx = useT().shell.activation
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ActivationError | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    try {
      await activate(code)
    } catch (err) {
      const e2 = err as ApiError
      setError({ code: e2.code, fallback: e2.message, retryAfterSeconds: e2.retryAfterSeconds })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="flex items-center gap-3 px-[var(--gutter)] py-2">
          <div className="-ml-2 flex items-center">
            <Logo className="size-16" />
            <span className="font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-foreground">edulab</span>
          </div>
          <div className="ml-auto">
            <LangSwitch />
          </div>
        </div>
      </header>

      <main className="flex-1 px-[var(--gutter)] pb-16 pt-8 md:pt-11">
        <div className="border-b pb-8">
          <h1 className="font-display text-[clamp(2.3rem,5vw,3.3rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground">{tx.title}</h1>
          <p className="mt-3.5 text-[1.15rem] leading-[1.6] text-[var(--ink-2)]">{tx.subtitle}</p>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
          <form onSubmit={submit} className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b border-hairline bg-subtle px-5 py-3.5">
              <IconBadge><KeyRound /></IconBadge>
              <h2 className="font-display text-[19px] font-bold leading-tight">{tx.formTitle}</h2>
            </div>
            <div className="px-5 py-5">
              <label htmlFor="code" className="mb-2 block font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-foreground">
                {tx.codeLabel}
              </label>
              <Input
                id="code"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder={tx.codePlaceholder}
                className="h-11 font-mono tracking-wide"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={!!error}
                aria-describedby="code-help"
              />
              {notice && !error && <p className="edu-block mt-3 rounded-lg bg-primary px-3 py-2 text-[13px] text-primary-foreground">{notice}</p>}
              {error && (
                <p role="alert" className="edu-block mt-3 rounded-lg bg-danger px-3 py-2 text-[13px] text-white">
                  {errorText(error, tx)}
                </p>
              )}
              <Button type="submit" variant="accent" size="lg" className="mt-4 h-11 w-full" disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                {busy ? tx.checking : tx.submit}
              </Button>
            </div>
            <p id="code-help" className="border-t border-dashed px-5 py-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
              {tx.help}
            </p>
          </form>

          <div className="grid gap-3">
            <div className="flex gap-3 rounded-lg border bg-card px-4 py-3.5 text-[14px] leading-relaxed text-[var(--ink-2)]">
              <IconBadge tone="ok"><ShieldCheck /></IconBadge>
              <span className="min-w-0">{tx.privacyLocal}</span>
            </div>
            <div className="flex gap-3 rounded-lg border bg-card px-4 py-3.5 text-[14px] leading-relaxed text-[var(--ink-2)]">
              <IconBadge tone="doc"><Lock /></IconBadge>
              <span className="min-w-0">{tx.sessionNote}</span>
            </div>
            <div className="rounded-lg bg-subtle px-4 py-3.5">
              <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">{tx.exploreNote}</p>
              <Button variant="outline" size="sm" className="mt-2.5" onClick={browseWithoutActivation}>
                <BookOpen /> {tx.explore}
              </Button>
            </div>
            {import.meta.env.DEV && <p className="font-mono text-[11px] text-muted-foreground">{tx.apiLabel(API_BASE_URL)}</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
