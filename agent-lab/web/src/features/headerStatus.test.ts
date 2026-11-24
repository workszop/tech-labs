import { describe, expect, it } from 'vitest'
import type { UsageInfo } from '@shared/api-types'
import { labStatus, quotaOf } from './headerStatus'

const usage = (tokensUsed: number, requestsUsed = 1): UsageInfo => ({ tokensUsed, tokenLimit: 1000, requestsUsed, requestLimit: 10, estimatedCostUsd: 0, codeExpiresAt: null })

describe('header lab status', () => {
  it('quota: share, tokens left, low above 85 %, exhausted at the token or request limit', () => {
    expect(quotaOf(null)).toBeNull()
    expect(quotaOf(usage(500))).toMatchObject({ pct: 50, tokensLeft: 500, low: false, exhausted: false })
    expect(quotaOf(usage(900))).toMatchObject({ low: true, exhausted: false })
    expect(quotaOf(usage(1200))).toMatchObject({ pct: 100, tokensLeft: 0, exhausted: true, low: false })
    expect(quotaOf(usage(10, 10))).toMatchObject({ exhausted: true })
  })

  it('red for a failed index or used-up quota, yellow while indexing or low, green otherwise', () => {
    expect(labStatus({ kb: 'ready', active: true, usage: usage(100) })).toBe('ok')
    expect(labStatus({ kb: 'indexing', active: true, usage: usage(100) })).toBe('warn')
    expect(labStatus({ kb: 'checking', active: true, usage: null })).toBe('warn')
    expect(labStatus({ kb: 'ready', active: true, usage: usage(900) })).toBe('warn')
    expect(labStatus({ kb: 'error', active: true, usage: usage(100) })).toBe('danger')
    expect(labStatus({ kb: 'ready', active: true, usage: usage(1000) })).toBe('danger')
    // browsing without a code: no index is expected yet
    expect(labStatus({ kb: 'idle', active: false, usage: null })).toBe('ok')
  })
})
