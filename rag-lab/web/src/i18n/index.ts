import { getState, useStore } from '@/state/store'
import type { Lang } from '@shared/api-types'
import { en, type Dict } from './en'
import { pl } from './pl'

export type { Dict, Lang }
export const LANGS: Lang[] = ['pl', 'en']
export const DEFAULT_LANG: Lang = 'pl'

const DICTS: Record<Lang, Dict> = { en, pl }

/** Strings for the current language; re-renders the component when the language changes. */
export function useT(): Dict {
  return DICTS[useStore((s) => s.settings.lang)]
}
export function useLang(): Lang {
  return useStore((s) => s.settings.lang)
}
/** Strings for the current language, for code outside React (actions, API client). */
export function t(): Dict {
  return DICTS[getState().settings.lang]
}
export function getLang(): Lang {
  return getState().settings.lang
}

/** Polish needs three plural forms (1 plik, 2 pliki, 5 plików); English uses `one` and `many`. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (getLang() === 'en') return n === 1 ? one : many
  const m10 = n % 10
  const m100 = n % 100
  if (n === 1) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
