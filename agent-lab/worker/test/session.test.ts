import { describe, expect, it } from 'vitest'
import type { SessionInfo, UsageInfo } from '../../shared/api-types'
import { sha256Hex } from '../src/crypto'
import { activate, api, auth, callWith, createCode, env, expectError, newSession } from './helpers'

describe('sessions', () => {
  it('GET /api/session returns SessionInfo for a valid token', async () => {
    const { token, session } = await newSession({ label: 'S1' })
    const res = await api('/api/session', { headers: auth(token) })
    expect(res.status).toBe(200)
    const info = (await res.json()) as SessionInfo
    expect(info.sessionRef).toBe(session.sessionRef)
    expect(info.label).toBe('S1')
    expect(info.capabilities.embeddingDimensions).toBe(256)
  })

  it('sessionRef is the first 8 chars of the token hash (session id)', async () => {
    const { token, session } = await newSession()
    expect(session.sessionRef).toBe((await sha256Hex(token)).slice(0, 8))
  })

  it('GET /api/usage returns UsageInfo', async () => {
    const { token } = await newSession({ requestLimit: 42, tokenLimit: 4242 })
    const res = await api('/api/usage', { headers: auth(token) })
    const u = (await res.json()) as UsageInfo
    expect(u).toEqual({ requestsUsed: 0, requestLimit: 42, tokensUsed: 0, tokenLimit: 4242, estimatedCostUsd: 0, codeExpiresAt: null })
  })

  it('requires a bearer token', async () => {
    await expectError(await api('/api/session'), 401, 'unauthorized')
    await expectError(await api('/api/session', { headers: { Authorization: 'Bearer nope' } }), 401, 'unauthorized')
    await expectError(
      await api('/api/session', { headers: { Authorization: `Bearer ${'A'.repeat(43)}` } }),
      401,
      'unauthorized',
    )
  })

  it('never accepts tokens in the query string', async () => {
    const { token } = await newSession()
    await expectError(await api(`/api/session?token=${token}`), 400, 'invalid_request')
    await expectError(await api(`/api/session?access_token=${token}`), 400, 'invalid_request')
  })

  it('expired sessions are rejected with session_expired', async () => {
    const { token } = await newSession()
    const id = await sha256Hex(token)
    await env.DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE id = ?1').bind(id, Date.now() - 1).run()
    await expectError(await api('/api/session', { headers: auth(token) }), 401, 'session_expired')
  })

  it('session expiry never exceeds the code expiry', async () => {
    const exp = Date.now() + 30 * 60_000
    const code = await createCode({ expiresAt: new Date(exp).toISOString() })
    const { session } = await activate(code.code)
    expect(Date.parse(session.expiresAt)).toBe(exp)
  })

  it('optional idle timeout (SESSION_IDLE_TIMEOUT_MINUTES) + sliding last_activity_at', async () => {
    const { token } = await newSession()
    const id = await sha256Hex(token)
    const idle = { SESSION_IDLE_TIMEOUT_MINUTES: '10' }
    // Recent activity → OK, and last_activity_at slides forward.
    await env.DB.prepare('UPDATE sessions SET last_activity_at = ?2 WHERE id = ?1').bind(id, Date.now() - 5 * 60_000).run()
    expect((await callWith(idle, '/api/session', { headers: auth(token) })).status).toBe(200)
    const row = await env.DB.prepare('SELECT last_activity_at FROM sessions WHERE id = ?1').bind(id).first<{ last_activity_at: number }>()
    expect(Date.now() - row!.last_activity_at).toBeLessThan(5000)
    // Idle too long → session_expired.
    await env.DB.prepare('UPDATE sessions SET last_activity_at = ?2 WHERE id = ?1').bind(id, Date.now() - 11 * 60_000).run()
    await expectError(await callWith(idle, '/api/session', { headers: auth(token) }), 401, 'session_expired')
  })

  it('logout revokes the session (and is idempotent)', async () => {
    const { token } = await newSession()
    expect((await api('/api/logout', { method: 'POST', headers: auth(token) })).status).toBe(204)
    await expectError(await api('/api/session', { headers: auth(token) }), 401, 'session_expired')
    expect((await api('/api/logout', { method: 'POST', headers: auth(token) })).status).toBe(204)
    await expectError(await api('/api/logout', { method: 'POST' }), 401, 'unauthorized')
  })

  it('a code that expires after activation ends access with expired_code', async () => {
    const { token, code } = await newSession()
    await env.DB.prepare('UPDATE access_codes SET expires_at = ?2 WHERE id = ?1').bind(code.id, Date.now() - 1).run()
    await expectError(await api('/api/session', { headers: auth(token) }), 403, 'expired_code')
  })

  it('unknown routes → not_found; health works without auth and leaks nothing', async () => {
    await expectError(await api('/api/nope'), 404, 'not_found')
    await expectError(await api('/api/session', { method: 'DELETE' }), 404, 'not_found')
    const h = await api('/api/health')
    expect(h.status).toBe(200)
    const body = (await h.json()) as Record<string, any>
    expect(body.status).toBe('ok')
    expect(body.provider).toBe('mock')
    expect(body.checks.database).toBe(true)
  })
})
