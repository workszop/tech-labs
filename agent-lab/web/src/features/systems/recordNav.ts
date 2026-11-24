/**
 * Opening a company record or a knowledge document in the record dialog, from
 * anywhere in the app (explorer rows, linked chips, chat sources, inspector
 * chunks). Independent of the app store: a tiny external store with a stack, so
 * a linked chip can open another record and "Back" returns to the previous one.
 *
 *   openRecord({ kind: 'order', id: 'ORD-2026-0187' })   // new dialog
 *   openRecordById('SHIP-2026-100')                        // kind from the ID prefix
 *
 * The single dialog host (`RecordDialogHost`) is mounted once in `App.tsx`.
 */
import { useSyncExternalStore } from 'react'

export type RecordKind = 'order' | 'customer' | 'product' | 'warranty' | 'shipment' | 'case' | 'interaction' | 'ticket' | 'document'
export interface RecordRef {
  kind: RecordKind
  id: string
}

const PREFIXES: [RegExp, RecordKind][] = [
  [/^ORD-\d{4}-\d{4}$/, 'order'],
  [/^CUST-\d{4}$/, 'customer'],
  [/^PRD-[A-Z]+-\d+$/, 'product'],
  [/^WAR-\d{4}$/, 'warranty'],
  [/^SHIP-\d{4}-\d{3}$/, 'shipment'],
  [/^CASE-\d{4}-\d{3}$/, 'case'],
  [/^INT-\d{4}$/, 'interaction'],
  [/^TCK-\d{4}-\d{4}$/, 'ticket'],
  [/^DOC-[\w-]+$/, 'document'],
]

/** Record kind of a Northstar ID (`ORD-2026-0187` -> `order`), or null for anything else. */
export function recordKindOf(id: string): RecordKind | null {
  for (const [re, kind] of PREFIXES) if (re.test(id)) return kind
  return null
}

let stack: RecordRef[] = []
const listeners = new Set<() => void>()
function set(next: RecordRef[]) {
  stack = next
  listeners.forEach((l) => l())
}

/** Opens the dialog on this record (replaces whatever the dialog showed). */
export function openRecord(ref: RecordRef) {
  set([{ kind: ref.kind, id: ref.id }])
}
/** Opens the record behind an ID; returns false when the ID is not a Northstar record ID. */
export function openRecordById(id: string): boolean {
  const kind = recordKindOf(id)
  if (kind) openRecord({ kind, id })
  return kind !== null
}
/** Follows a link from the record shown now ("Back" returns to it). */
export function pushRecord(ref: RecordRef) {
  const top = stack.at(-1)
  if (top && top.kind === ref.kind && top.id === ref.id) return
  set([...stack, { kind: ref.kind, id: ref.id }])
}
export function backRecord() {
  if (stack.length) set(stack.slice(0, -1))
}
export function closeRecord() {
  set([])
}
export function getRecordStack(): readonly RecordRef[] {
  return stack
}
export function subscribeRecords(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export function useRecordStack(): readonly RecordRef[] {
  return useSyncExternalStore(subscribeRecords, getRecordStack, getRecordStack)
}
