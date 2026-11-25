import { describe, expect, it } from 'vitest'
import type { ChatResponse, EmbeddingsResponse } from '../../shared/api-types'
import { api, auth, env, expectError, jsonInit, newSession, sampleContext } from './helpers'

const embed = (token: string, inputs: string[]) => api('/api/embeddings', jsonInit('POST', { inputs }, auth(token)))

describe('quotas', () => {
  it('exactly request_limit requests succeed, then 402 quota_exceeded', async () => {
    const { token } = await newSession({ requestLimit: 2 })
    expect((await embed(token, ['a'])).status).toBe(200)
    expect((await embed(token, ['b'])).status).toBe(200)
    await expectError(await embed(token, ['c']), 402, 'quota_exceeded')
  })

  it('is concurrency-safe: 10 parallel requests against a limit of 3 → exactly 3 succeed', async () => {
    const { token, code } = await newSession({ requestLimit: 3 })
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => embed(token, [`parallel ${i}`])))
    const statuses = res.map((r) => r.status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(3)
    expect(statuses.filter((s) => s === 402)).toHaveLength(7)
    const row = await env.DB.prepare('SELECT requests_used FROM access_codes WHERE id = ?1').bind(code.id).first<{ requests_used: number }>()
    expect(row!.requests_used).toBe(3)
  })

  it('token budget is also concurrency-safe (parallel chat with reservation of input + maxTokens)', async () => {
    // Each request reserves ≈ input estimate + 200 output tokens; budget allows only a few.
    const { token, code } = await newSession({ tokenLimit: 1500 })
    const body = { question: 'How many remote days?', context: sampleContext, mode: 'rag', stream: false, maxTokens: 200 }
    const res = await Promise.all(Array.from({ length: 10 }, () => api('/api/chat', jsonInit('POST', body, auth(token)))))
    const ok = res.filter((r) => r.status === 200).length
    const rejected = res.filter((r) => r.status === 402).length
    expect(ok + rejected).toBe(10)
    expect(ok).toBeGreaterThan(0)
    expect(rejected).toBeGreaterThan(0)
    const row = await env.DB.prepare('SELECT tokens_used, token_limit FROM access_codes WHERE id = ?1').bind(code.id).first<{
      tokens_used: number
      token_limit: number
    }>()
    expect(row!.tokens_used).toBeLessThanOrEqual(row!.token_limit)
  })

  it('reconciles the token estimate with actual usage and records cost + usage_events (no text)', async () => {
    const { token, code } = await newSession()
    const res = await api(
      '/api/chat',
      jsonInit('POST', { question: 'How many days remote?', context: sampleContext, mode: 'rag', stream: false, maxTokens: 1024 }, auth(token)),
    )
    const body = (await res.json()) as ChatResponse
    // Reservation was input + 1024; after reconciliation only actual usage remains.
    expect(body.quota.tokensUsed).toBe(body.usage.inputTokens + body.usage.outputTokens)
    expect(body.quota.tokensUsed).toBeLessThan(1024)
    const expectedCost = (body.usage.inputTokens * 0.1 + body.usage.outputTokens * 0.5) / 1e6
    expect(body.quota.estimatedCostUsd).toBeCloseTo(expectedCost, 10)

    const e = (await (await embed(token, ['hello world'])).json()) as EmbeddingsResponse
    expect(e.quota.estimatedCostUsd).toBeCloseTo(expectedCost + (e.usage.inputTokens * 0.02) / 1e6, 10)

    const { results } = await env.DB.prepare('SELECT * FROM usage_events WHERE access_code_id = ?1 ORDER BY created_at').bind(code.id).all()
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ operation: 'chat', model: 'mock-extractive-chat', status: 'ok' })
    expect(results[1]).toMatchObject({ operation: 'embeddings', model: 'mock-hash-embedding-256', status: 'ok' })
    const dump = JSON.stringify(results)
    expect(dump).not.toContain('remote')
    expect(dump).not.toContain('hello world')
    expect(Object.keys(results[0]!).sort()).toEqual(
      ['access_code_id', 'created_at', 'estimated_cost', 'id', 'input_tokens', 'model', 'operation', 'output_tokens', 'session_id', 'status'].sort(),
    )
  })

  it('a request that needs more tokens than remain is rejected up front', async () => {
    const { token } = await newSession({ tokenLimit: 100 })
    await expectError(
      await api('/api/chat', jsonInit('POST', { question: 'q?', context: sampleContext, mode: 'rag', maxTokens: 500 }, auth(token))),
      402,
      'quota_exceeded',
    )
  })

  it('a disabled code blocks further use with revoked_code', async () => {
    const { token, code } = await newSession()
    await env.DB.prepare("UPDATE access_codes SET status = 'disabled' WHERE id = ?1").bind(code.id).run()
    await expectError(await embed(token, ['a']), 403, 'revoked_code')
  })
})
