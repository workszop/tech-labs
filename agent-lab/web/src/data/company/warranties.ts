import { ORDERS } from './orders'
import { PRODUCTS } from './products'
import type { Localized, Warranty } from './types'

/** Adds whole months to an ISO date; the day is clamped to the length of the target month. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ty = Math.floor(total / 12)
  const tm = (total % 12) + 1
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate()
  const td = Math.min(d, last)
  return `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`
}

/** Units whose warranty passed to another customer: warranty ID -> new owner. */
const TRANSFERS: Record<string, { toCustomerId: string; date: string }> = {
  // Anna Kowalska gave her ChefMix 900 to her daughter Zofia Kowalska.
  'WAR-0010': { toCustomerId: 'CUST-1048', date: '2025-05-10' },
}

/** Warranties voided by an exclusion of the warranty terms. */
const VOIDED: Record<string, { date: string; reason: Localized }> = {
  'WAR-0016': {
    date: '2026-06-12',
    reason: {
      en: 'Exclusion: unauthorised repair. The housing was opened and a non-original pump was fitted by a third-party workshop (inspection in service case CASE-2026-017).',
      pl: 'Wyłączenie: nieautoryzowana naprawa. Obudowa została otwarta, a zewnętrzny warsztat zamontował nieoryginalną pompę (oględziny w sprawie serwisowej CASE-2026-017).',
    },
  },
}

const PRODUCT = new Map(PRODUCTS.map((p) => [p.id, p]))

/**
 * One warranty per delivered serialised unit. The start is the purchase date
 * of the order and the length always comes from the product (12, 24 or 36 months).
 */
export const WARRANTIES: Warranty[] = ORDERS.flatMap((order) =>
  order.lines
    .filter((l) => l.warrantyId !== null && l.serialNumber !== null)
    .map((l): Warranty => {
      const product = PRODUCT.get(l.productId)
      if (!product) throw new Error(`warranties: unknown product ${l.productId}`)
      const id = l.warrantyId as string
      const transfer = TRANSFERS[id]
      return {
        id,
        serialNumber: l.serialNumber as string,
        productId: l.productId,
        orderId: order.id,
        customerId: transfer ? transfer.toCustomerId : order.customerId,
        startDate: order.date,
        endDate: addMonths(order.date, product.warrantyMonths),
        months: product.warrantyMonths,
        voided: VOIDED[id] ?? null,
        transfer: transfer ? { fromCustomerId: order.customerId, date: transfer.date } : null,
      }
    }),
).sort((a, b) => a.id.localeCompare(b.id))
