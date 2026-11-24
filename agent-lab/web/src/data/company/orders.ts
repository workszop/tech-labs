import { PRODUCTS } from './products'
import type { Order, OrderLine } from './types'

/** [productId, serialNumber | null, warrantyId | null, quantity?] */
type LineRow = [string, string | null, string | null, number?]

const PRICE = new Map(PRODUCTS.map((p) => [p.id, p.priceEur]))

function o(id: string, customerId: string, date: string, channel: Order['channel'], status: Order['status'], rows: LineRow[]): Order {
  const lines: OrderLine[] = rows.map(([productId, serialNumber, warrantyId, quantity]) => {
    const unitPriceEur = PRICE.get(productId)
    if (unitPriceEur === undefined) throw new Error(`orders: unknown product ${productId}`)
    return { productId, quantity: quantity ?? 1, unitPriceEur, serialNumber, warrantyId }
  })
  const totalEur = Math.round(lines.reduce((s, l) => s + l.unitPriceEur * l.quantity, 0) * 100) / 100
  return { id, customerId, date, channel, status, lines, totalEur }
}

/**
 * 50 orders. The ID carries the year of purchase; numbers grow with the date
 * (the shop takes a few orders a day, so only some numbers belong to the
 * customers in this sample). Store and partner sales have no Northstar shipment.
 */
export const ORDERS: Order[] = [
  // 2023
  o('ORD-2023-0122', 'CUST-1038', '2023-02-16', 'store', 'delivered', [['PRD-SMART-5', 'HHC-23-05561', 'WAR-0001']]),
  o('ORD-2023-0382', 'CUST-1026', '2023-05-27', 'partner', 'delivered', [['PRD-VAC-5', 'CM900-23-00387', 'WAR-0002']]),
  o('ORD-2023-0601', 'CUST-1012', '2023-08-19', 'store', 'delivered', [['PRD-KITCHEN-4', 'QB600-23-08840', 'WAR-0003']]),
  o('ORD-2023-0788', 'CUST-1012', '2023-10-30', 'partner', 'delivered', [['PRD-COFFEE-4', 'ES1-23-12230', 'WAR-0004']]),

  // 2024
  o('ORD-2024-0039', 'CUST-1054', '2024-01-15', 'partner', 'delivered', [['PRD-KITCHEN-5', 'TL4-24-00811', 'WAR-0005']]),
  o('ORD-2024-0107', 'CUST-1005', '2024-02-10', 'partner', 'delivered', [['PRD-KITCHEN-2', 'AF5-24-20931', 'WAR-0006']]),
  o('ORD-2024-0133', 'CUST-1057', '2024-02-20', 'partner', 'delivered', [['PRD-AIR-6', 'PA100-24-05519', 'WAR-0007']]),
  o('ORD-2024-0198', 'CUST-1036', '2024-03-16', 'partner', 'delivered', [['PRD-COFFEE-2', 'BP300-24-02215', 'WAR-0008']]),
  o('ORD-2024-0226', 'CUST-1031', '2024-03-27', 'partner', 'delivered', [['PRD-VAC-3', 'AC6-24-11290', 'WAR-0009']]),
  o('ORD-2024-0434', 'CUST-1001', '2024-06-15', 'online', 'delivered', [['PRD-KITCHEN-1', 'CX900-24-03117', 'WAR-0010']]),
  o('ORD-2024-0510', 'CUST-1026', '2024-07-14', 'store', 'delivered', [['PRD-KITCHEN-6', 'IC2-24-04128', 'WAR-0011']]),
  o('ORD-2024-0653', 'CUST-1051', '2024-09-07', 'store', 'delivered', [['PRD-VAC-5', 'CM900-24-06650', 'WAR-0012']]),
  o('ORD-2024-0832', 'CUST-1038', '2024-11-15', 'online', 'delivered', [['PRD-VAC-4', 'RC5-24-21177', 'WAR-0013']]),
  o('ORD-2024-0876', 'CUST-1008', '2024-12-02', 'online', 'delivered', [['PRD-VAC-2', 'AC10-24-15502', 'WAR-0014']]),

  // 2025
  o('ORD-2025-0052', 'CUST-1060', '2025-01-20', 'partner', 'delivered', [['PRD-KITCHEN-1', 'CX900-25-01164', 'WAR-0015']]),
  o('ORD-2025-0117', 'CUST-1019', '2025-02-14', 'online', 'delivered', [['PRD-COFFEE-2', 'BP300-25-04471', 'WAR-0016']]),
  o('ORD-2025-0229', 'CUST-1045', '2025-03-29', 'partner', 'delivered', [['PRD-KITCHEN-3', 'SC30-25-03390', 'WAR-0017']]),
  o('ORD-2025-0307', 'CUST-1001', '2025-04-28', 'store', 'delivered', [['PRD-AIR-1', 'PA200-25-07788', 'WAR-0018']]),
  o('ORD-2025-0325', 'CUST-1060', '2025-05-05', 'online', 'returned', [['PRD-AIR-4', 'BPM-25-01880', null]]),
  o('ORD-2025-0356', 'CUST-1008', '2025-05-17', 'store', 'delivered', [['PRD-AIR-4', 'BPM-25-02291', 'WAR-0019']]),
  o('ORD-2025-0429', 'CUST-1033', '2025-06-14', 'online', 'delivered', [['PRD-AIR-2', 'PA300-25-18834', 'WAR-0020']]),
  o('ORD-2025-0494', 'CUST-1057', '2025-07-09', 'online', 'delivered', [
    ['PRD-SMART-1', 'HH1-25-02208', 'WAR-0021'],
    ['PRD-SMART-4', 'LG1-25-04476', 'WAR-0022'],
  ]),
  o('ORD-2025-0559', 'CUST-1005', '2025-08-03', 'online', 'delivered', [['PRD-VAC-1', 'AC8-25-06652', 'WAR-0023']]),
  o('ORD-2025-0608', 'CUST-1017', '2025-08-22', 'online', 'delivered', [['PRD-VAC-4', 'RC5-25-30418', 'WAR-0024']]),
  o('ORD-2025-0702', 'CUST-1031', '2025-09-27', 'online', 'delivered', [['PRD-AIR-2', 'PA300-25-21567', 'WAR-0025']]),
  o('ORD-2025-0751', 'CUST-1036', '2025-10-16', 'online', 'delivered', [['PRD-COFFEE-3', 'BC200-25-14420', 'WAR-0026']]),
  o('ORD-2025-0863', 'CUST-1029', '2025-11-28', 'online', 'delivered', [['PRD-COFFEE-3', 'BC200-25-17760', 'WAR-0027']]),
  o('ORD-2025-0907', 'CUST-1048', '2025-12-15', 'partner', 'delivered', [['PRD-KITCHEN-4', 'QB600-25-27719', 'WAR-0028']]),

  // 2026
  o('ORD-2026-0101', 'CUST-1051', '2026-02-08', 'online', 'delivered', [['PRD-KITCHEN-3', 'SC30-26-01277', 'WAR-0029']]),
  o('ORD-2026-0151', 'CUST-1054', '2026-02-27', 'online', 'delivered', [['PRD-COFFEE-1', 'BP500-26-03342', 'WAR-0030']]),
  o('ORD-2026-0187', 'CUST-1042', '2026-03-12', 'online', 'delivered', [['PRD-COFFEE-1', 'BP500-26-10482', 'WAR-0031']]),
  o('ORD-2026-0231', 'CUST-1036', '2026-03-30', 'store', 'delivered', [['PRD-VAC-1', 'AC8-26-08127', 'WAR-0032']]),
  o('ORD-2026-0260', 'CUST-1029', '2026-04-10', 'online', 'delivered', [
    ['PRD-COFFEE-7', null, null],
    ['PRD-COFFEE-6', null, null, 2],
  ]),
  o('ORD-2026-0273', 'CUST-1017', '2026-04-15', 'online', 'delivered', [['PRD-SMART-3', 'CS1-26-01934', 'WAR-0033']]),
  o('ORD-2026-0335', 'CUST-1012', '2026-05-09', 'online', 'delivered', [['PRD-COFFEE-6', null, null, 3]]),
  o('ORD-2026-0364', 'CUST-1054', '2026-05-20', 'online', 'cancelled', [['PRD-KITCHEN-2', null, null]]),
  o('ORD-2026-0424', 'CUST-1060', '2026-06-12', 'online', 'delivered', [['PRD-COFFEE-5', 'BP700-26-00402', 'WAR-0034']]),
  o('ORD-2026-0471', 'CUST-1033', '2026-06-30', 'online', 'delivered', [['PRD-AIR-5', null, null]]),
  o('ORD-2026-0473', 'CUST-1019', '2026-07-01', 'online', 'delivered', [['PRD-KITCHEN-2', 'AF5-26-33410', 'WAR-0035']]),
  o('ORD-2026-0523', 'CUST-1042', '2026-07-20', 'online', 'delivered', [
    ['PRD-COFFEE-6', null, null, 2],
    ['PRD-COFFEE-7', null, null],
  ]),
  o('ORD-2026-0588', 'CUST-1057', '2026-08-14', 'online', 'delivered', [['PRD-VAC-2', 'AC10-26-29105', 'WAR-0036']]),
  o('ORD-2026-0619', 'CUST-1048', '2026-08-26', 'store', 'delivered', [['PRD-SMART-2', 'SP2-26-07188', 'WAR-0037']]),
  o('ORD-2026-0624', 'CUST-1023', '2026-08-28', 'online', 'delivered', [
    ['PRD-AIR-3', 'PA500-26-08821', 'WAR-0038'],
    ['PRD-AIR-5', null, null],
  ]),
  o('ORD-2026-0689', 'CUST-1038', '2026-09-22', 'online', 'delivered', [['PRD-SMART-2', 'SP2-26-07730', 'WAR-0039']]),
  o('ORD-2026-0728', 'CUST-1026', '2026-10-07', 'online', 'delivered', [['PRD-COFFEE-5', 'BP700-26-00915', 'WAR-0040']]),
  o('ORD-2026-0790', 'CUST-1026', '2026-10-31', 'online', 'delivered', [['PRD-COFFEE-6', null, null, 2]]),
  o('ORD-2026-0796', 'CUST-1031', '2026-11-02', 'online', 'returned', [['PRD-VAC-2', 'AC10-26-40213', null]]),
  o('ORD-2026-0832', 'CUST-1045', '2026-11-16', 'online', 'awaiting_pickup', [['PRD-AIR-3', 'PA500-26-12260', 'WAR-0041']]),
  o('ORD-2026-0845', 'CUST-1023', '2026-11-21', 'online', 'in_transit', [['PRD-SMART-4', 'LG1-26-09952', 'WAR-0042']]),
  o('ORD-2026-0848', 'CUST-1001', '2026-11-22', 'online', 'in_transit', [['PRD-SMART-1', 'HH1-26-04410', 'WAR-0043']]),
]
