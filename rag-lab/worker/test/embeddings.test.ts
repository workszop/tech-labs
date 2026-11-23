import { describe, expect, it } from 'vitest'
import type { EmbeddingsResponse } from '../../shared/api-types'
import { estimateTokens } from '../../shared/prompt'
import { api, auth, avoidMinuteBoundary, callWith, expectError, jsonInit, newSession } from './helpers'

function cosine(a: number[], b: number[]): number {
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return d / Math.sqrt(na * nb)
}

async function embed(token: string, inputs: unknown, extra: Record<string, unknown> = {}) {
  return api('/api/embeddings', jsonInit('POST', { inputs, ...extra }, auth(token)))
}

describe('POST /api/embeddings (mock provider)', () => {
  it('returns one normalised 256-d vector per input in order, plus usage and quota', async () => {
    const { token } = await newSession()
    const inputs = ['Remote work policy', 'Laptop replacement every three years', 'Cafeteria menu']
    const res = await embed(token, inputs)
    expect(res.status).toBe(200)
    const body = (await res.json()) as EmbeddingsResponse
    expect(body.model).toBe('mock-hash-embedding-256')
    expect(body.dimensions).toBe(256)
    expect(body.embeddings).toHaveLength(3)
    for (const v of body.embeddings) {
      expect(v).toHaveLength(256)
      expect(Math.hypot(...v)).toBeCloseTo(1, 5)
    }
    const est = inputs.reduce((n, s) => n + estimateTokens(s), 0)
    expect(body.usage.inputTokens).toBe(est)
    expect(body.quota.requestsUsed).toBe(1)
    expect(body.quota.tokensUsed).toBe(est)
    expect(body.quota.estimatedCostUsd).toBeGreaterThan(0)
    expect(typeof body.durationMs).toBe('number')

    // Order: embedding a single input yields the same vector as its position in the batch.
    const single = (await (await embed(token, [inputs[1]])).json()) as EmbeddingsResponse
    expect(single.embeddings[0]).toEqual(body.embeddings[1])
  })

  it('is deterministic, and similar texts are closer than unrelated ones', async () => {
    const { token } = await newSession()
    const texts = [
      'Employees may work remotely up to three days per week with manager approval.',
      'How many days per week can employees work remotely?',
      'The cafeteria serves vegetarian lasagna on Fridays.',
    ]
    const a = (await (await embed(token, texts)).json()) as EmbeddingsResponse
    const b = (await (await embed(token, texts)).json()) as EmbeddingsResponse
    expect(a.embeddings).toEqual(b.embeddings)
    const [doc, q, other] = a.embeddings as [number[], number[], number[]]
    const simRelated = cosine(doc, q)
    const simUnrelated = cosine(doc, other)
    expect(simRelated).toBeGreaterThan(simUnrelated)
    expect(simRelated).toBeGreaterThan(0.3)
  })

  it('validates inputs', async () => {
    const { token } = await newSession()
    await expectError(await embed(token, []), 400, 'invalid_request')
    await expectError(await embed(token, 'not-an-array'), 400, 'invalid_request')
    await expectError(await embed(token, ['ok', 3]), 400, 'invalid_request')
    await expectError(await embed(token, ['   ']), 400, 'invalid_request')
  })

  it('enforces batch size, per-input token and body-size limits (413)', async () => {
    const { token } = await newSession()
    await expectError(await embed(token, Array.from({ length: 65 }, (_, i) => `t${i}`)), 413, 'payload_too_large')
    expect((await embed(token, Array.from({ length: 64 }, (_, i) => `t${i}`))).status).toBe(200)
    await expectError(await embed(token, ['x'.repeat(2001 * 4)]), 413, 'payload_too_large')
    // > 512 KB body
    const big = Array.from({ length: 64 }, () => 'y'.repeat(8500))
    await expectError(await embed(token, big), 413, 'payload_too_large')
  })

  it('rejects a client-chosen model (model_not_allowed)', async () => {
    const { token } = await newSession()
    await expectError(await embed(token, ['a'], { model: 'text-embedding-3-large' }), 400, 'model_not_allowed')
    expect((await embed(token, ['a'], { model: 'mock-hash-embedding-256' })).status).toBe(200)
  })

  it('requires a session and JSON content type', async () => {
    await expectError(await api('/api/embeddings', jsonInit('POST', { inputs: ['a'] })), 401, 'unauthorized')
    const { token } = await newSession()
    await expectError(
      await api('/api/embeddings', { method: 'POST', headers: auth(token, { 'Content-Type': 'text/plain' }), body: '{"inputs":["a"]}' }),
      400,
      'invalid_request',
    )
  })

  it('applies the per-session rate limit (429 + retryAfterSeconds)', async () => {
    await avoidMinuteBoundary()
    const { token } = await newSession()
    const overrides = { RATE_LIMIT_PER_MINUTE: '3' }
    const init = () => jsonInit('POST', { inputs: ['a'] }, auth(token))
    for (let i = 0; i < 3; i++) expect((await callWith(overrides, '/api/embeddings', init())).status).toBe(200)
    const res = await callWith(overrides, '/api/embeddings', init())
    const body = await expectError(res, 429, 'rate_limited')
    expect(body.error.retryAfterSeconds).toBeGreaterThan(0)
    expect(body.error.retryAfterSeconds).toBeLessThanOrEqual(60)
    // Another session is not affected.
    const other = await newSession()
    expect((await callWith(overrides, '/api/embeddings', jsonInit('POST', { inputs: ['a'] }, auth(other.token)))).status).toBe(200)
  })

  it('default per-session limit is RATE_LIMIT_PER_MINUTE=30', async () => {
    await avoidMinuteBoundary(8000)
    const { token } = await newSession()
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) statuses.push((await embed(token, ['a'])).status)
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses[30]).toBe(429)
  })
})
