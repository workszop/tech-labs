/**
 * Record types of the fictional company Northstar Appliances. The same names and
 * IDs are used in both languages; only free-text fields are `Localized`.
 * Dates are ISO `YYYY-MM-DD`; shipment events carry `YYYY-MM-DDTHH:mm`.
 */

export interface Localized {
  pl: string
  en: string
}

export type ProductCategory = 'coffee_machine' | 'vacuum_cleaner' | 'air_purifier' | 'kitchen_appliance' | 'smart_home'

export interface Product {
  id: string // PRD-<FAMILY>-<n>
  model: string // human model name, e.g. "Northstar Barista Pro 500"
  category: ProductCategory
  /** Appliances are serialised and get a warranty record per unit; accessories and consumables are not. */
  kind: 'appliance' | 'accessory'
  /** Prefix of the unit serial numbers (appliances only), e.g. "BP500". */
  serialPrefix: string | null
  warrantyMonths: 12 | 24 | 36
  priceEur: number
  launchYear: number
  inProduction: boolean
  /** Last production date of a discontinued product. */
  discontinued: string | null
  description: Localized
}

export interface Customer {
  id: string // CUST-nnnn
  name: string
  email: string
  phone: string
  address: { street: string; postalCode: string; city: string; country: string }
  preferredLanguage: 'pl' | 'en'
  segment: 'consumer' | 'small_business'
  customerSince: string
  notes: Localized
}

export interface OrderLine {
  productId: string
  quantity: number
  unitPriceEur: number
  /** Serial number of the delivered unit; null for accessories and for cancelled orders. */
  serialNumber: string | null
  /** Warranty of the unit; null for accessories and for returned or cancelled orders. */
  warrantyId: string | null
}

export interface Order {
  id: string // ORD-<year of purchase>-nnnn
  customerId: string
  date: string
  channel: 'online' | 'store' | 'partner'
  status: 'delivered' | 'in_transit' | 'awaiting_pickup' | 'returned' | 'cancelled'
  lines: OrderLine[]
  totalEur: number
}

export interface Warranty {
  id: string // WAR-nnnn
  serialNumber: string
  productId: string
  orderId: string
  /** Current owner of the unit (differs from the order's customer after a transfer). */
  customerId: string
  startDate: string // purchase date of the order
  endDate: string // start + product warranty months
  months: 12 | 24 | 36
  /** Set when an exclusion of the warranty terms voided the warranty. */
  voided: { date: string; reason: Localized } | null
  /** Set when the unit and its warranty passed to another customer. */
  transfer: { fromCustomerId: string; date: string } | null
}

export type ShipmentStatus = 'delivered' | 'in_transit' | 'delayed' | 'awaiting_pickup' | 'returned'

export interface ShipmentEvent {
  at: string // YYYY-MM-DDTHH:mm
  location: string
  code:
    | 'label_created'
    | 'picked_up'
    | 'arrived_hub'
    | 'departed_hub'
    | 'out_for_delivery'
    | 'delivered'
    | 'delayed'
    | 'ready_for_pickup'
    | 'not_collected'
    | 'returned_to_sender'
    | 'dropped_off'
    | 'received_at_warehouse'
  description: Localized
}

export interface Shipment {
  id: string // SHIP-<year>-nnn
  customerId: string
  type: 'order_delivery' | 'replacement_part' | 'return'
  orderId: string | null
  caseId: string | null
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  contents: Localized
  from: string
  to: string
  shippedDate: string
  estimatedDelivery: string
  deliveredDate: string | null
  events: ShipmentEvent[]
}

export type CaseStatus = 'open' | 'waiting_for_part' | 'in_repair' | 'resolved' | 'escalated'

export interface ServiceCase {
  id: string // CASE-<year>-nnn
  customerId: string
  productId: string
  serialNumber: string
  warrantyId: string
  openedDate: string
  status: CaseStatus
  errorCode: string | null
  fault: Localized
  coveredByWarranty: boolean
  /** Date promised to the customer for the repair or the next step, if any. */
  promisedDate: string | null
  resolvedDate: string | null
  resolution: Localized | null
  shipmentIds: string[]
  history: { date: string; note: Localized }[]
}

export interface Interaction {
  id: string // INT-nnnn
  customerId: string
  date: string
  channel: 'phone' | 'email' | 'chat' | 'store'
  type: 'inquiry' | 'service_request' | 'complaint' | 'follow_up' | 'feedback'
  subject: Localized
  summary: Localized
  outcome: Localized
  caseId: string | null
  orderId: string | null
  handledBy: string
}

/** A service ticket created by the agent (after the customer approved it). */
export interface Ticket {
  id: string // TCK-2026-nnnn
  customerId: string
  productId: string
  issueDescription: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open'
  createdDate: string
  createdBy: 'agent'
}
