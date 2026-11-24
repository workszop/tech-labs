/**
 * The simulated company systems: one IndexedDB database (Dexie) holding the
 * Northstar records. The tools read and write only this database, so a learner
 * can watch the same rows in the data explorer. `resetSimulation` restores the
 * seed and removes tickets created by the agent.
 *
 * Schema versions: version 1 holds the company tables. Later tasks add their own
 * tables (runs, conversation, prefs) with `this.version(2).stores({...})`;
 * Dexie keeps the tables of earlier versions.
 */
import Dexie, { liveQuery, type Table } from 'dexie'
import { useEffect, useState } from 'react'
import { COMPANY_SEED, type CompanySeed } from '@/data/company'
import type { Customer, Interaction, Order, Product, ServiceCase, Shipment, Ticket, Warranty } from '@/data/company/types'

export const SIM_DB_NAME = 'agent-lab-sim'

/** Company tables of schema version 1 (primary key first, then indexes). */
export const SIM_SCHEMA_V1 = {
  customers: 'id',
  products: 'id, category',
  orders: 'id, customerId',
  warranties: 'id, &serialNumber, customerId, orderId',
  shipments: 'id, customerId, orderId, caseId',
  cases: 'id, customerId',
  interactions: 'id, customerId, caseId',
  tickets: 'id, customerId',
} as const

export type TableName = keyof CompanySeed

export const TABLE_NAMES = Object.keys(SIM_SCHEMA_V1) as TableName[]

export class SimDatabase extends Dexie {
  customers!: Table<Customer, string>
  products!: Table<Product, string>
  orders!: Table<Order, string>
  warranties!: Table<Warranty, string>
  shipments!: Table<Shipment, string>
  cases!: Table<ServiceCase, string>
  interactions!: Table<Interaction, string>
  tickets!: Table<Ticket, string>
  constructor(name = SIM_DB_NAME) {
    super(name)
    this.version(1).stores(SIM_SCHEMA_V1)
  }
}

export const simDb = new SimDatabase()

function companyTables() {
  return TABLE_NAMES.map((t) => simDb.table(t))
}

async function writeSeed(): Promise<void> {
  // Deep copies, so later writes never touch the seed modules.
  const seed = structuredClone(COMPANY_SEED)
  for (const name of TABLE_NAMES) {
    const rows = seed[name] as unknown[]
    if (rows.length) await simDb.table(name).bulkAdd(rows)
  }
}

/** Fills the database with the seed records on first use; existing data (including tickets) is kept. */
export async function seedIfEmpty(): Promise<void> {
  await simDb.transaction('rw', companyTables(), async () => {
    if ((await simDb.customers.count()) > 0) return
    await Promise.all(companyTables().map((t) => t.clear()))
    await writeSeed()
  })
}

/** Restores every company table to the seed state and removes the tickets the agent created. */
export async function resetSimulation(): Promise<void> {
  await simDb.transaction('rw', companyTables(), async () => {
    await Promise.all(companyTables().map((t) => t.clear()))
    await writeSeed()
  })
}

/** Live rows of one table for the data explorer; re-renders when the table changes. */
export function useTable<T>(table: TableName): T[] {
  const [rows, setRows] = useState<T[]>([])
  useEffect(() => {
    const sub = liveQuery(() => simDb.table(table).toArray() as Promise<T[]>).subscribe({
      next: (r) => setRows(r),
      error: () => setRows([]),
    })
    return () => sub.unsubscribe()
  }, [table])
  return rows
}
