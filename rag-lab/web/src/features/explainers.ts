/** Short-first, deeper-on-demand explanations used across the app. Texts live in the i18n dictionaries. */
import type { Lang } from '@shared/api-types'
import { t, useT } from '@/i18n'
import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'

export interface Explainer {
  title: string
  short: string
  body: string[]
}

export type ExplainerTopic = keyof typeof en.shell.explainers

/** Topic ids in display order (identical in every language). */
export const EXPLAINER_TOPICS = Object.keys(en.shell.explainers) as ExplainerTopic[]

/** Explainers for the current language; re-renders the component when the language changes. */
export function useExplainers(): Record<string, Explainer> {
  return useT().shell.explainers
}

/** Explainers for a given language (default: the current one), for code outside React. */
export function getExplainers(lang?: Lang): Record<string, Explainer> {
  if (lang === 'en') return en.shell.explainers
  if (lang === 'pl') return pl.shell.explainers
  return t().shell.explainers
}

/**
 * Compatibility export: looks like the old constant, but every property reads the
 * dictionary of the current language at access time. Prefer `useExplainers()` in
 * components; this object does not subscribe to language changes by itself.
 */
export const EXPLAINERS: Record<string, Explainer> = Object.defineProperties(
  {},
  Object.fromEntries(EXPLAINER_TOPICS.map((k) => [k, { enumerable: true, get: (): Explainer => t().shell.explainers[k] }])),
)
