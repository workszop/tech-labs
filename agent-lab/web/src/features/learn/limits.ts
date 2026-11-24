/**
 * The run limits quoted by the explanations: the ones the Worker publishes in
 * the session (`capabilities.agent`), or the defaults with "by default" wording
 * when there is no session yet.
 */
import { currentLocale } from '@/lib/utils'
import { useT } from '@/i18n'
import { useStore } from '@/state/store'

export interface LearnLimits {
  steps: number
  calls: number
  tokens: number
  /** True when the numbers come from the session, false for the defaults. */
  fromSession: boolean
}

export const DEFAULT_LIMITS: LearnLimits = { steps: 8, calls: 12, tokens: 80000, fromSession: false }

/** Replaces `{steps}`, `{calls}`, `{tokens}` and `{byDefault}` in a text. */
export function fillLimits(text: string, l: LearnLimits, byDefault: string, locale = 'en'): string {
  const n = (v: number) => new Intl.NumberFormat(locale).format(v)
  return text
    .replaceAll('{steps}', n(l.steps))
    .replaceAll('{calls}', n(l.calls))
    .replaceAll('{tokens}', n(l.tokens))
    .replaceAll('{byDefault}', l.fromSession ? '' : byDefault)
}

export function useLearnLimits(): LearnLimits {
  const agent = useStore((s) => s.auth.session?.capabilities.agent)
  return agent ? { steps: agent.maxSteps, calls: agent.maxToolCalls, tokens: agent.maxRunTokens, fromSession: true } : DEFAULT_LIMITS
}

/** A function that fills the current limits into a learn text. */
export function useFillLimits(): (text: string) => string {
  const l = useLearnLimits()
  const byDefault = useT().learn.byDefault
  const locale = currentLocale()
  return (text) => fillLimits(text, l, byDefault, locale)
}
