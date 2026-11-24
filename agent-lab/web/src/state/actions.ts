/** Session and language actions. Later tasks add the agent run orchestration here. */
import type { Lang, SessionInfo } from '@shared/api-types'
import { t } from '@/i18n'
import { api, onAuthLost } from '@/api/client'
import { getState, setSettings, setState } from './store'

export function initApp() {
  onAuthLost((err) => {
    setState((s) => ({
      auth: { status: 'locked', session: null, notice: err.code === 'session_expired' ? t().shell.actions.sessionExpired : err.message },
      usage: s.usage,
    }))
  })
}

/** Switch the UI language. */
export function setLang(lang: Lang) {
  if (getState().settings.lang === lang) return
  setSettings({ lang })
  document.documentElement.lang = lang
}

export async function activate(code: string): Promise<SessionInfo> {
  const session = await api.activate(code)
  setState({ auth: { status: 'active', session, notice: null }, usage: session.usage })
  return session
}

export function browseWithoutActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'browsing', notice: null } }))
}

export function showActivation() {
  setState((s) => ({ auth: { ...s.auth, status: 'locked' } }))
}

export async function logout() {
  await api.logout().catch(() => undefined)
  setState({ auth: { status: 'locked', session: null, notice: t().shell.actions.loggedOut } })
}

export async function refreshUsage() {
  try {
    const usage = await api.usage()
    setState({ usage })
  } catch {
    /* auth errors are handled by onAuthLost */
  }
}
