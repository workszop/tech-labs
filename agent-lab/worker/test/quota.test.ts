import { describe, expect, it } from 'vitest'
import { api, auth, env, expectError, jsonInit, newSession } from './helpers'

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

  it('a disabled code blocks further use with revoked_code', async () => {
    const { token, code } = await newSession()
    await env.DB.prepare("UPDATE access_codes SET status = 'disabled' WHERE id = ?1").bind(code.id).run()
    await expectError(await embed(token, ['a']), 403, 'revoked_code')
  })
})
