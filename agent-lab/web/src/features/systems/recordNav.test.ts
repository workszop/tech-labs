import { beforeEach, describe, expect, it } from 'vitest'
import { backRecord, closeRecord, getRecordStack, openRecord, pushRecord, subscribeRecords } from './recordNav'

describe('record dialog navigation', () => {
  beforeEach(() => closeRecord())

  it('openRecord starts a new stack, pushRecord follows a link, backRecord returns', () => {
    openRecord({ kind: 'order', id: 'ORD-2026-0187' })
    expect(getRecordStack()).toEqual([{ kind: 'order', id: 'ORD-2026-0187' }])
    pushRecord({ kind: 'customer', id: 'CUST-1042' })
    expect(getRecordStack().map((r) => r.id)).toEqual(['ORD-2026-0187', 'CUST-1042'])
    backRecord()
    expect(getRecordStack().map((r) => r.id)).toEqual(['ORD-2026-0187'])
    openRecord({ kind: 'document', id: 'DOC-warranty-terms' })
    expect(getRecordStack()).toEqual([{ kind: 'document', id: 'DOC-warranty-terms' }])
    closeRecord()
    expect(getRecordStack()).toEqual([])
  })

  it('pushing the record that is already shown does not grow the stack', () => {
    openRecord({ kind: 'order', id: 'ORD-2026-0187' })
    pushRecord({ kind: 'order', id: 'ORD-2026-0187' })
    expect(getRecordStack()).toHaveLength(1)
  })

  it('notifies subscribers on every change', () => {
    let n = 0
    const off = subscribeRecords(() => n++)
    openRecord({ kind: 'case', id: 'CASE-2026-033' })
    pushRecord({ kind: 'customer', id: 'CUST-1051' })
    backRecord()
    closeRecord()
    off()
    openRecord({ kind: 'case', id: 'CASE-2026-033' })
    expect(n).toBe(4)
  })
})
