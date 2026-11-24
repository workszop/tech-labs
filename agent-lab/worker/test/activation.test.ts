import { describe, expect, it } from 'vitest'
import type { ActivateResponse } from '../../shared/api-types'
import {
  activate,
  activateRaw,
  adminHeaders,
  api,
  auth,
  callWith,
  createCode,
  env,
  expectError,
  freshIp,
  jsonInit,
} from './helpers'
import { sha256Hex } from '../src/crypto'

describe('POST /api/activate', () => {
  it('activates a valid code and returns token + SessionInfo', async () => {
    const code = await createCode({ label: 'Workshop A' })
    expect(code.code).toMatch(/^AGT(-[0-9A-HJKMNP-TV-Z]{4}){5}$/)
    const res = await activateRaw(code.code)
    expect(res.status).toBe(200)
    const body = (await res.json()) as ActivateResponse
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.session.label).toBe('Workshop A')
    expect(body.session.sessionRef).toHaveLength(8)
    expect(Date.parse(body.session.expiresAt)).toBeGreaterThan(Date.now() + 3 * 3600_000)
    expect(body.session.capabilities).toMatchObject({
      provider: 'mock',
      embeddingModel: 'mock-hash-embedding-256',
      embeddingDimensions: 256,
      chatModel: 'mock-rule-based-agent',
      maxEmbeddingBatch: 64,
      maxEmbeddingInputTokens: 2000,
      agent: { maxSteps: 8, maxToolCalls: 12, maxParallelToolCalls: 5, maxRunTokens: 80000, maxMessageChars: 1000 },
    })
    expect(body.session.usage).toMatchObject({ requestsUsed: 0, requestLimit: 600, tokensUsed: 0, tokenLimit: 1500000 })
  })

  it('stores only the token hash and the code HMAC, never plaintext', async () => {
    const code = await createCode()
    const { token } = await activate(code.code)
    const dump = JSON.stringify([
      (await env.DB.prepare('SELECT * FROM access_codes').all()).results,
      (await env.DB.prepare('SELECT * FROM sessions').all()).results,
    ])
    expect(dump).not.toContain(token)
    expect(dump).not.toContain(code.code)
    expect(dump).not.toContain(code.code.replace(/-/g, '').slice(3))
  })

  it('normalises input: lowercase, spaces, missing dashes, O→0 and I/L→1', async () => {
    const code = await createCode({ maxSessions: 10 })
    const body = code.code.slice(4) // without "AGT-"
    const variants = [
      `  ${code.code.toLowerCase()}  `,
      body.replace(/-/g, ' '),
      body.replace(/-/g, ''),
      code.code.replace(/0/g, 'O').replace(/1/g, 'l'),
    ]
    for (const v of variants) {
      const res = await activateRaw(v)
      expect(res.status, v).toBe(200)
    }
  })

  it('rejects unknown and malformed codes with the same invalid_code shape', async () => {
    const a = await expectError(await activateRaw('AGT-AAAA-BBBB-CCCC-DDDD-EEEE'), 401, 'invalid_code')
    const b = await expectError(await activateRaw('hello'), 401, 'invalid_code')
    const c = await expectError(await activateRaw('x'.repeat(500)), 401, 'invalid_code')
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('rejects bad bodies with invalid_request', async () => {
    await expectError(await api('/api/activate', jsonInit('POST', { nope: 1 })), 400, 'invalid_request')
    await expectError(await api('/api/activate', { method: 'POST', body: '{"code":"x"}' }), 400, 'invalid_request')
    await expectError(
      await api('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }),
      400,
      'invalid_request',
    )
  })

  it('rejects expired codes', async () => {
    const code = await createCode({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
    await expectError(await activateRaw(code.code), 403, 'expired_code')
  })

  it('rejects revoked and disabled codes', async () => {
    const revoked = await createCode()
    await api(`/api/admin/codes/${revoked.id}`, { method: 'DELETE', headers: adminHeaders() })
    await expectError(await activateRaw(revoked.code), 403, 'revoked_code')

    const disabled = await createCode()
    await api(`/api/admin/codes/${disabled.id}`, jsonInit('PATCH', { status: 'disabled' }, adminHeaders()))
    await expectError(await activateRaw(disabled.code), 403, 'revoked_code')
  })

  it('a code at max_sessions revokes its least recently used session on the next activation (finding 5)', async () => {
    const code = await createCode({ maxSessions: 3 })
    const s1 = await activate(code.code)
    const s2 = await activate(code.code)
    const s3 = await activate(code.code)
    // Make s2 the least recently used: s1 and s3 are used after it.
    const t0 = Date.now() - 60_000
    for (const [s, at] of [[s2, t0], [s1, t0 + 10_000], [s3, t0 + 20_000]] as const) {
      await env.DB.prepare('UPDATE sessions SET last_activity_at = ?2 WHERE id = ?1').bind(await sha256Hex(s.token), at).run()
    }
    const s4 = await activate(code.code)
    expect(s4.token).toMatch(/\S+/)
    // Exactly the least recently used session (s2) is revoked; the others keep working.
    await expectError(await api('/api/session', { headers: auth(s2.token) }), 401, 'session_expired')
    for (const s of [s1, s3, s4]) expect((await api('/api/session', { headers: auth(s.token) })).status).toBe(200)
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE access_code_id = ?1 AND revoked_at IS NULL').bind(code.id).all<{ n: number }>()
    expect(results[0]!.n).toBe(3)
  })

  it('a logout frees a slot without revoking anyone', async () => {
    const code = await createCode({ maxSessions: 2 })
    const s1 = await activate(code.code)
    const s2 = await activate(code.code)
    const out = await api('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${s1.token}` } })
    expect(out.status).toBe(204)
    expect((await activateRaw(code.code)).status).toBe(200)
    expect((await api('/api/session', { headers: auth(s2.token) })).status).toBe(200)
  })

  it('concurrent activations never leave more than max_sessions active sessions', async () => {
    const code = await createCode({ maxSessions: 2 })
    const results = await Promise.all(Array.from({ length: 6 }, () => activateRaw(code.code)))
    expect(results.every((r) => r.status === 200)).toBe(true)
    const { results: rows } = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE access_code_id = ?1 AND revoked_at IS NULL').bind(code.id).all<{ n: number }>()
    expect(rows[0]!.n).toBe(2)
  })

  it('throttles per client IP after ACTIVATION_MAX_ATTEMPTS failures (429 + retryAfterSeconds)', async () => {
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      await expectError(await activateRaw('AGT-0000-0000-0000-0000-0000', ip), 401, 'invalid_code')
    }
    const res = await activateRaw('AGT-0000-0000-0000-0000-0000', ip)
    const body = await expectError(res, 429, 'rate_limited')
    expect(body.error.retryAfterSeconds).toBeGreaterThan(0)
    expect(body.error.retryAfterSeconds).toBeLessThanOrEqual(900)
    expect(res.headers.get('Retry-After')).toBe(String(body.error.retryAfterSeconds))
    // Even a valid code is refused from the throttled IP...
    const code = await createCode()
    await expectError(await activateRaw(code.code, ip), 429, 'rate_limited')
    // ...but works from another network.
    expect((await activateRaw(code.code, freshIp())).status).toBe(200)
  })

  it('throttles parallel guessing from one IP (atomic counter)', async () => {
    const ip = freshIp()
    const res = await Promise.all(Array.from({ length: 25 }, () => activateRaw('AGT-1111-1111-1111-1111-1111', ip)))
    const s = res.map((r) => r.status)
    expect(s.filter((x) => x === 401)).toHaveLength(10)
    expect(s.filter((x) => x === 429)).toHaveLength(15)
  })

  it('successful activations do not consume the IP failure budget', async () => {
    const ip = freshIp()
    const code = await createCode({ maxSessions: 20 })
    for (let i = 0; i < 12; i++) expect((await activateRaw(code.code, ip)).status).toBe(200)
  })

  it('applies a global failed-attempt ceiling per minute', async () => {
    const overrides = { ACTIVATION_GLOBAL_FAILURES_PER_MINUTE: '3' }
    let limited: Response | null = null
    for (let i = 0; i < 10 && !limited; i++) {
      const r = await callWith(overrides, '/api/activate', jsonInit('POST', { code: 'nope' }, { 'CF-Connecting-IP': freshIp() }))
      if (r.status === 429) limited = r
      else expect(r.status).toBe(401)
    }
    expect(limited).not.toBeNull()
    const body = await expectError(limited!, 429, 'rate_limited')
    expect(body.error.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('stores a peppered hash of the IP, not the raw IP', async () => {
    const ip = '203.0.113.77'
    await activateRaw('AGT-2222-2222-2222-2222-2222', ip)
    const { results } = await env.DB.prepare('SELECT key FROM rate_limits').all<{ key: string }>()
    expect(results.some((r) => r.key.includes(ip))).toBe(false)
    expect(results.some((r) => r.key.startsWith('act:ip:'))).toBe(true)
  })
})
