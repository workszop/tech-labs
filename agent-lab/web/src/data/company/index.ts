import { CASES } from './cases'
import { CUSTOMERS } from './customers'
import { INTERACTIONS } from './interactions'
import { ORDERS } from './orders'
import { PRODUCTS } from './products'
import { SHIPMENTS } from './shipments'
import type { Customer, Interaction, Order, Product, ServiceCase, Shipment, Ticket, Warranty } from './types'
import { WARRANTIES } from './warranties'

export type * from './types'
export { CASES, CUSTOMERS, INTERACTIONS, ORDERS, PRODUCTS, SHIPMENTS, WARRANTIES }

/** The seed state of every simulated company system. Agent-created tickets start empty. */
export interface CompanySeed {
  customers: Customer[]
  products: Product[]
  orders: Order[]
  warranties: Warranty[]
  shipments: Shipment[]
  cases: ServiceCase[]
  interactions: Interaction[]
  tickets: Ticket[]
}

export const COMPANY_SEED: CompanySeed = {
  customers: CUSTOMERS,
  products: PRODUCTS,
  orders: ORDERS,
  warranties: WARRANTIES,
  shipments: SHIPMENTS,
  cases: CASES,
  interactions: INTERACTIONS,
  tickets: [],
}
