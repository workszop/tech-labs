/**
 * One short, localized sentence per tool result. It is UI text for the
 * execution graph and the timeline; it is never sent to the model.
 */
import type { Lang } from '@shared/api-types'
import type { CaseStatus, ShipmentStatus, Ticket } from '@/data/company/types'
import type { ToolErrorCode } from './tools'

function plural(lang: Lang, n: number, forms: { en: [string, string]; pl: [string, string, string] }): string {
  if (lang === 'en') return `${n} ${n === 1 ? forms.en[0] : forms.en[1]}`
  const m10 = n % 10
  const m100 = n % 100
  const w = n === 1 ? forms.pl[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? forms.pl[1] : forms.pl[2]
  return `${n} ${w}`
}

const SHIPMENT_STATUS: Record<ShipmentStatus, { en: string; pl: string }> = {
  delivered: { en: 'delivered', pl: 'doręczona' },
  in_transit: { en: 'in transit', pl: 'w drodze' },
  delayed: { en: 'delayed', pl: 'opóźniona' },
  awaiting_pickup: { en: 'awaiting pickup', pl: 'czeka na odbiór' },
  returned: { en: 'returned', pl: 'zwrócona' },
}

const CASE_STATUS: Record<CaseStatus, { en: string; pl: string }> = {
  open: { en: 'open', pl: 'otwarta' },
  waiting_for_part: { en: 'waiting for a part', pl: 'czeka na część' },
  in_repair: { en: 'in repair', pl: 'w naprawie' },
  resolved: { en: 'resolved', pl: 'zamknięta' },
  escalated: { en: 'escalated', pl: 'przekazana wyżej' },
}

const PRIORITY: Record<Ticket['priority'], { en: string; pl: string }> = {
  low: { en: 'low', pl: 'niski' },
  normal: { en: 'normal', pl: 'normalny' },
  high: { en: 'high', pl: 'wysoki' },
  urgent: { en: 'urgent', pl: 'pilny' },
}

/** What a refused or missing record was, in the two languages (nominative / genitive for Polish). */
export type RecordKind = 'customer' | 'order' | 'shipment' | 'case' | 'serial' | 'product'

const KIND: Record<RecordKind, { en: string; pl: string; plGen: string }> = {
  customer: { en: 'customer data', pl: 'dane', plGen: 'klienta' },
  order: { en: 'order', pl: 'zamówienie', plGen: 'zamówienia' },
  shipment: { en: 'shipment', pl: 'przesyłka', plGen: 'przesyłki' },
  case: { en: 'service case', pl: 'sprawa serwisowa', plGen: 'sprawy serwisowej' },
  serial: { en: 'unit with this serial number', pl: 'urządzenie o tym numerze seryjnym', plGen: 'gwarancji dla tego numeru seryjnego' },
  product: { en: 'product', pl: 'produkt', plGen: 'produktu' },
}

export const summarize = {
  profile: (lang: Lang, name: string, id: string) => (lang === 'pl' ? `Profil klienta: ${name} (${id})` : `Customer profile: ${name} (${id})`),

  orders: (lang: Lang, count: number, lastId: string | null) => {
    if (!count || !lastId) return lang === 'pl' ? 'Brak zamówień' : 'No orders'
    const n = plural(lang, count, { en: ['order', 'orders'], pl: ['zamówienie', 'zamówienia', 'zamówień'] })
    return lang === 'pl' ? `${n}, ostatnie ${lastId}` : `${n}, last one ${lastId}`
  },

  product: (lang: Lang, model: string, months: number, inProduction: boolean) =>
    lang === 'pl'
      ? `${model}: gwarancja ${months} mies., ${inProduction ? 'w produkcji' : 'wycofany z produkcji'}`
      : `${model}: ${months}-month warranty, ${inProduction ? 'in production' : 'out of production'}`,

  warranty: (lang: Lang, status: 'active' | 'expired' | 'void', endDate: string, daysRemaining: number) => {
    if (status === 'void') return lang === 'pl' ? 'Gwarancja unieważniona (wyłączenie z warunków gwarancji)' : 'Warranty void (exclusion in the warranty terms)'
    if (status === 'expired') return lang === 'pl' ? `Gwarancja wygasła ${endDate}` : `Warranty expired on ${endDate}`
    const days = plural(lang, daysRemaining, { en: ['day', 'days'], pl: ['dzień', 'dni', 'dni'] })
    return lang === 'pl' ? `Gwarancja aktywna do ${endDate} (zostało: ${days})` : `Warranty active until ${endDate} (${days} left)`
  },

  shipments: (lang: Lang, count: number, highlight: { id: string; status: ShipmentStatus } | null) => {
    if (!count || !highlight) return lang === 'pl' ? 'Brak przesyłek' : 'No shipments'
    const n = plural(lang, count, { en: ['shipment', 'shipments'], pl: ['przesyłka', 'przesyłki', 'przesyłek'] })
    return `${n}; ${highlight.id}: ${SHIPMENT_STATUS[highlight.status][lang]}`
  },

  track: (lang: Lang, id: string, status: ShipmentStatus, estimated: string, delivered: string | null) => {
    const s = SHIPMENT_STATUS[status][lang]
    if (delivered) return lang === 'pl' ? `${id}: ${s} ${delivered}` : `${id}: ${s} on ${delivered}`
    return lang === 'pl' ? `${id}: ${s}, szacowany termin ${estimated}` : `${id}: ${s}, estimated delivery ${estimated}`
  },

  crm: (lang: Lang, count: number, lastDate: string | null) => {
    if (!count || !lastDate) return lang === 'pl' ? 'Brak interakcji w CRM' : 'No CRM interactions'
    const n = plural(lang, count, { en: ['interaction', 'interactions'], pl: ['interakcja', 'interakcje', 'interakcji'] })
    return lang === 'pl' ? `${n}, ostatnia ${lastDate}` : `${n}, last on ${lastDate}`
  },

  knowledge: (lang: Lang, count: number, bestTitle: string | null) => {
    if (!count || !bestTitle) return lang === 'pl' ? 'Brak pasujących fragmentów' : 'No matching passages'
    const n = plural(lang, count, { en: ['passage', 'passages'], pl: ['fragment', 'fragmenty', 'fragmentów'] })
    return lang === 'pl' ? `${n}, najlepszy: ${bestTitle}` : `${n}, best: ${bestTitle}`
  },

  serviceCase: (lang: Lang, id: string, status: CaseStatus, overdue: boolean) => {
    const s = CASE_STATUS[status][lang]
    if (!overdue) return `${id}: ${s}`
    return lang === 'pl' ? `${id}: ${s}, obiecany termin minął` : `${id}: ${s}, promised date passed`
  },

  ticket: (lang: Lang, id: string, priority: Ticket['priority']) =>
    lang === 'pl' ? `Utworzono zgłoszenie ${id} (priorytet: ${PRIORITY[priority].pl})` : `Ticket ${id} created (${PRIORITY[priority].en} priority)`,

  forbidden: (lang: Lang, kind: RecordKind) => {
    if (kind === 'customer') return lang === 'pl' ? 'Brak dostępu: dane innego klienta' : "Access denied: another customer's data"
    return lang === 'pl' ? `Brak dostępu: ${KIND[kind].pl} należy do innego klienta` : `Access denied: the ${KIND[kind].en} belongs to another customer`
  },

  notFound: (lang: Lang, kind: RecordKind) =>
    lang === 'pl' ? `Nie znaleziono ${KIND[kind].plGen}` : `Not found: no such ${KIND[kind].en}`,
}

const ERROR: Record<ToolErrorCode, { en: string; pl: string }> = {
  forbidden: { en: 'Access denied', pl: 'Brak dostępu' },
  not_found: { en: 'Not found', pl: 'Nie znaleziono' },
  invalid_arguments: { en: 'Invalid arguments', pl: 'Nieprawidłowe argumenty' },
  unknown_tool: { en: 'Unknown tool', pl: 'Nieznane narzędzie' },
  tool_disabled: { en: 'Tool disabled in this session', pl: 'Narzędzie wyłączone w tej sesji' },
  too_many_calls: { en: 'Too many tool calls', pl: 'Za dużo wywołań narzędzi' },
  rejected_by_user: { en: 'Rejected by the customer', pl: 'Odrzucone przez klienta' },
  duplicate_call: { en: 'Repeated identical call', pl: 'Powtórzone identyczne wywołanie' },
  index_not_ready: { en: 'Knowledge base not ready', pl: 'Baza wiedzy nie jest gotowa' },
  failed: { en: 'Tool failed', pl: 'Narzędzie zakończyło się błędem' },
  not_executed: { en: 'Not run', pl: 'Nie uruchomiono' },
  result_unknown: { en: 'Result not recorded', pl: 'Wynik nie został zapisany' },
}

/** Generic summary for an error code (used when no more specific sentence applies). */
export function errorSummary(lang: Lang, code: ToolErrorCode): string {
  return ERROR[code][lang]
}
