/** Pure status logic of the header: quota of the access code and the overall state of the compact status button. */
import type { UsageInfo } from '@shared/api-types'
import type { KbIndexState } from '@/state/store'

export interface Quota {
  usage: UsageInfo
  /** Share of the token limit used, 0-100. */
  pct: number
  tokensLeft: number
  /** No tokens or no requests left. */
  exhausted: boolean
  /** More than 85 % of the tokens used, not yet exhausted. */
  low: boolean
}

export function quotaOf(usage: UsageInfo | null): Quota | null {
  if (!usage) return null
  const pct = Math.min(100, (usage.tokensUsed / Math.max(1, usage.tokenLimit)) * 100)
  const tokensLeft = Math.max(0, usage.tokenLimit - usage.tokensUsed)
  const exhausted = tokensLeft <= 0 || usage.requestsUsed >= usage.requestLimit
  return { usage, pct, tokensLeft, exhausted, low: !exhausted && pct > 85 }
}

/** Red when the index failed or the quota is used up, yellow while the index is not ready (after activation) or the quota is low. */
export function labStatus(p: { kb: KbIndexState['status']; active: boolean; usage: UsageInfo | null }): 'ok' | 'warn' | 'danger' {
  const q = quotaOf(p.usage)
  if (p.kb === 'error' || q?.exhausted) return 'danger'
  if ((p.active && p.kb !== 'ready') || q?.low) return 'warn'
  return 'ok'
}
