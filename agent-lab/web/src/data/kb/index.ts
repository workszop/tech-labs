/**
 * The Northstar service knowledge base: 25 documents in each language.
 *
 * Metadata (authority, status, products, effective date) is language-independent
 * and kept once here; titles and bodies come from `en/` and `pl/`, which use the
 * same ids, numbers and section structure. Model names in `appliesTo` are
 * spelled exactly as in `data/company/products.ts`.
 */
import type { Lang } from '@shared/api-types'
import type { KbDocument, KbDocumentMeta, KbDocumentText } from './types'
import { EN_AIR } from './en/air'
import { EN_COFFEE } from './en/coffee'
import { EN_HOME } from './en/home'
import { EN_POLICIES } from './en/policies'
import { EN_SUPPORT } from './en/support'
import { EN_VACUUM } from './en/vacuum'
import { PL_AIR } from './pl/air'
import { PL_COFFEE } from './pl/coffee'
import { PL_HOME } from './pl/home'
import { PL_POLICIES } from './pl/policies'
import { PL_SUPPORT } from './pl/support'
import { PL_VACUUM } from './pl/vacuum'

const BP500 = 'Northstar Barista Pro 500'
const COFFEE_AUTOMATIC = [BP500, 'Northstar Barista Pro 300', 'Northstar Barista Compact 200', 'Northstar Barista Pro 700 Duo']
const PUREAIR_300 = 'Northstar PureAir 300'

type Meta = Omit<KbDocumentMeta, 'id'>
const meta = (authority: Meta['authority'], appliesTo: string[], effectiveDate: string, extra: Partial<Meta> = {}): Meta => ({
  authority,
  status: 'current',
  appliesTo,
  effectiveDate,
  ...extra,
})

/** Document order is the order of the knowledge explorer. */
export const KB_META: Record<string, Meta> = {
  // Coffee machines
  'DOC-bp500-manual': meta('manual', [BP500], '2025-03-01'),
  'DOC-bp500-error-codes': meta('model_specific', [BP500], '2025-09-15'),
  'DOC-bp500-e04-troubleshooting': meta('model_specific', [BP500], '2026-02-10'),
  'DOC-coffee-descaling': meta('manual', COFFEE_AUTOMATIC, '2025-06-01'),
  'DOC-compact-200-guide': meta('manual', ['Northstar Barista Compact 200'], '2025-04-01'),
  'DOC-coffee-repair-procedure': meta('support_procedure', [...COFFEE_AUTOMATIC, 'Northstar Espresso One'], '2026-01-20'),
  // Vacuum cleaners
  'DOC-aeroclean-manual': meta('manual', ['Northstar AeroClean V8', 'Northstar AeroClean V10'], '2024-09-01'),
  'DOC-vacuum-battery-faults': meta('model_specific', ['Northstar AeroClean V6', 'Northstar AeroClean V8', 'Northstar AeroClean V10', 'Northstar AeroClean Spare Battery'], '2026-03-01'),
  'DOC-roboclean-r5-guide': meta('model_specific', ['Northstar RoboClean R5'], '2025-05-12'),
  // Air purifiers
  'DOC-pureair-300-manual': meta('manual', [PUREAIR_300], '2024-04-01'),
  'DOC-pureair-sensor-calibration-2025': meta('model_specific', [PUREAIR_300], '2025-03-10', { status: 'superseded', supersededBy: 'DOC-sb-2026-07' }),
  'DOC-sb-2026-07': meta('service_bulletin', [PUREAIR_300], '2026-08-03'),
  'DOC-pureair-filter-care': meta('manual', ['Northstar PureAir 200', PUREAIR_300, 'Northstar PureAir 500 Smart', 'Northstar HEPA H13 Filter (PureAir 300/500)'], '2025-02-01'),
  // Kitchen and smart home
  'DOC-kitchen-overheating': meta('model_specific', ['Northstar AirCrisp 5', 'Northstar InductaCook 2', 'Northstar ToastLine 4'], '2025-11-03'),
  'DOC-steamchef-oven-30-guide': meta('manual', ['Northstar SteamChef Oven 30'], '2024-10-01'),
  'DOC-smart-wifi-connectivity': meta(
    'manual',
    ['Northstar Home Hub', 'Northstar Home Hub Classic', 'Northstar SmartPlug Duo', 'Northstar ClimaSense', 'Northstar LeakGuard', 'Northstar PureAir 500 Smart', 'Northstar RoboClean R5'],
    '2026-04-15',
  ),
  // Warranty, returns and delivery
  'DOC-warranty-terms': meta('warranty_policy', [], '2026-01-01'),
  'DOC-warranty-exclusions': meta('warranty_policy', [], '2026-01-01'),
  'DOC-paid-repairs': meta('warranty_policy', [], '2026-01-01'),
  'DOC-returns-policy': meta('warranty_policy', [], '2025-07-01'),
  'DOC-shipping-delivery': meta('support_procedure', [], '2026-03-01'),
  'DOC-parts-compatibility': meta('support_procedure', [], '2026-09-01'),
  // Support procedures and safety
  'DOC-support-escalation': meta('support_procedure', [], '2026-05-04'),
  'DOC-complaint-handling': meta('support_procedure', [], '2026-05-04'),
  'DOC-electrical-safety-notice': meta('service_bulletin', [], '2025-10-01'),
}

const TEXTS: Record<Lang, KbDocumentText[]> = {
  en: [...EN_COFFEE, ...EN_VACUUM, ...EN_AIR, ...EN_HOME, ...EN_POLICIES, ...EN_SUPPORT],
  pl: [...PL_COFFEE, ...PL_VACUUM, ...PL_AIR, ...PL_HOME, ...PL_POLICIES, ...PL_SUPPORT],
}

const cache = new Map<Lang, KbDocument[]>()

/** All documents of a language, in the order of `KB_META`. Throws if a text or its metadata is missing. */
export function kbDocuments(lang: Lang): KbDocument[] {
  let docs = cache.get(lang)
  if (!docs) {
    const byId = new Map(TEXTS[lang].map((t) => [t.id, t]))
    if (byId.size !== TEXTS[lang].length) throw new Error(`kb: duplicate document id in "${lang}"`)
    for (const id of byId.keys()) if (!KB_META[id]) throw new Error(`kb: no metadata for ${id}`)
    docs = Object.entries(KB_META).map(([id, m]) => {
      const t = byId.get(id)
      if (!t) throw new Error(`kb: ${id} has no "${lang}" text`)
      return { id, title: t.title, ...m, body: t.body }
    })
    cache.set(lang, docs)
  }
  return docs
}
