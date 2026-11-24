import { describe, expect, it } from 'vitest'
import type { AdminCodeRecord, AdminListCodesResponse } from '../../shared/api-types'
import { clearJwksCache, verifyAccessJwt } from '../src/auth/admin'
import { base64url } from '../src/crypto'
import { ADMIN_TOKEN, activate, activateRaw, adminHeaders, api, auth, callWith, createCodes, env, expectError, jsonInit, newSession } from './helpers'

describe('admin auth', () => {
  it('requires admin auth; participant session tokens and access codes are rejected', async () => {
    await expectError(await api('/api/admin/codes'), 401, 'unauthorized')
    const { token, code } = await newSession()
    await expectError(await api('/api/admin/codes', { headers: auth(token) }), 401, 'unauthorized')
    await expectError(await api('/api/admin/codes', { headers: auth(code.code) }), 401, 'unauthorized')
    await expectError(await api('/api/admin/codes', { headers: auth(ADMIN_TOKEN + 'x') }), 401, 'unauthorized')
    await expectError(await api('/api/admin/codes', jsonInit('POST', { count: 1 }, auth(token))), 401, 'unauthorized')
    expect((await api('/api/admin/codes', { headers: adminHeaders() })).status).toBe(200)
  })

  it('rejects everything when ADMIN_TOKEN is unset or too short', async () => {
    await expectError(await callWith({ ADMIN_TOKEN: '' }, '/api/admin/codes', { headers: auth('') }), 401, 'unauthorized')
    await expectError(await callWith({ ADMIN_TOKEN: 'short' }, '/api/admin/codes', { headers: auth('short') }), 401, 'unauthorized')
  })
})

describe('admin codes CRUD', () => {
  it('creates codes with defaults and returns plaintext once', async () => {
    const codes = await createCodes({ count: 3, label: 'Workshop Nov' })
    expect(codes).toHaveLength(3)
    expect(new Set(codes.map((c) => c.code)).size).toBe(3)
    for (const c of codes) {
      expect(c).toMatchObject({ label: 'Workshop Nov', status: 'active', requestLimit: 600, tokenLimit: 1500000, maxSessions: 3, requestsUsed: 0, activeSessions: 0 })
      expect(c.code).toMatch(/^AGT(-[0-9A-Z]{4}){5}$/)
    }
    const list = (await (await api('/api/admin/codes', { headers: adminHeaders() })).json()) as AdminListCodesResponse
    const listed = list.codes.find((c) => c.id === codes[0]!.id)!
    expect(listed).toBeTruthy()
    expect(JSON.stringify(list)).not.toContain(codes[0]!.code)
    expect('code' in listed).toBe(false)
  })

  it('validates create input', async () => {
    const post = (b: unknown) => api('/api/admin/codes', jsonInit('POST', b, adminHeaders()))
    await expectError(await post({ count: 0 }), 400, 'invalid_request')
    await expectError(await post({ count: 201 }), 400, 'invalid_request')
    await expectError(await post({ requestLimit: -1 }), 400, 'invalid_request')
    await expectError(await post({ maxSessions: 0 }), 400, 'invalid_request')
    await expectError(await post({ expiresAt: 'tomorrow-ish' }), 400, 'invalid_request')
  })

  it('lists codes with usage, active sessions and totals', async () => {
    const [c] = await createCodes({ count: 1, label: 'list-test', requestLimit: 10 })
    await activate(c!.code)
    await activate(c!.code)
    const list = (await (await api('/api/admin/codes', { headers: adminHeaders() })).json()) as AdminListCodesResponse
    const rec = list.codes.find((x) => x.id === c!.id)!
    expect(rec.activeSessions).toBe(2)
    expect(rec.lastUsedAt).not.toBeNull()
    expect(list.totals.requests).toBe(list.codes.reduce((n, x) => n + x.requestsUsed, 0))
  })

  it('updates limits, expiry, label, status, reset usage, revoke sessions', async () => {
    const { code, token } = await newSession({ requestLimit: 1 })
    const embed = () => api('/api/embeddings', jsonInit('POST', { inputs: ['x'] }, auth(token)))
    expect((await embed()).status).toBe(200)
    await expectError(await embed(), 402, 'quota_exceeded')

    const patch = (b: unknown) => api(`/api/admin/codes/${code.id}`, jsonInit('PATCH', b, adminHeaders()))
    let rec = (await (await patch({ requestLimit: 5, tokenLimit: 9999, label: 'renamed', expiresAt: '2099-12-31' })).json()) as AdminCodeRecord
    expect(rec).toMatchObject({ requestLimit: 5, tokenLimit: 9999, label: 'renamed', requestsUsed: 1, status: 'active' })
    expect(rec.expiresAt).toBe('2099-12-31T23:59:59.999Z')
    expect((await embed()).status).toBe(200)

    rec = (await (await patch({ resetUsage: true })).json()) as AdminCodeRecord
    expect(rec).toMatchObject({ requestsUsed: 0, tokensUsed: 0, estimatedCostUsd: 0 })

    rec = (await (await patch({ status: 'disabled' })).json()) as AdminCodeRecord
    expect(rec.status).toBe('disabled')
    await expectError(await embed(), 403, 'revoked_code')
    rec = (await (await patch({ status: 'active', expiresAt: null })).json()) as AdminCodeRecord
    expect(rec.status).toBe('active')
    expect(rec.expiresAt).toBeNull()
    expect((await embed()).status).toBe(200)

    rec = (await (await patch({ revokeSessions: true })).json()) as AdminCodeRecord
    expect(rec.activeSessions).toBe(0)
    await expectError(await api('/api/session', { headers: auth(token) }), 401, 'session_expired')
    // The code itself still works.
    expect((await activateRaw(code.code)).status).toBe(200)

    await expectError(await patch({ status: 'revoked' }), 400, 'invalid_request')
    await expectError(await patch({ requestLimit: 1.5 }), 400, 'invalid_request')
    await expectError(await api('/api/admin/codes/code_doesnotexist', jsonInit('PATCH', {}, adminHeaders())), 404, 'not_found')
  })

  it('DELETE revokes the code and kills its sessions', async () => {
    const { code, token } = await newSession()
    const res = await api(`/api/admin/codes/${code.id}`, { method: 'DELETE', headers: adminHeaders() })
    expect(res.status).toBe(200)
    const rec = (await res.json()) as AdminCodeRecord
    expect(rec.status).toBe('revoked')
    expect(rec.revokedAt).not.toBeNull()
    expect(rec.activeSessions).toBe(0)
    await expectError(await api('/api/session', { headers: auth(token) }), 401, 'session_expired')
    await expectError(await api('/api/embeddings', jsonInit('POST', { inputs: ['x'] }, auth(token))), 401, 'session_expired')
    await expectError(await activateRaw(code.code), 403, 'revoked_code')
    // Cannot be re-enabled.
    await expectError(await api(`/api/admin/codes/${code.id}`, jsonInit('PATCH', { status: 'active' }, adminHeaders())), 400, 'invalid_request')
    await expectError(await api('/api/admin/codes/code_nope', { method: 'DELETE', headers: adminHeaders() }), 404, 'not_found')
  })

  it('expired and exhausted codes show the derived status', async () => {
    const [a, b] = await createCodes({ count: 2, requestLimit: 0 })
    await env.DB.prepare('UPDATE access_codes SET expires_at = 1 WHERE id = ?1').bind(a!.id).run()
    const list = (await (await api('/api/admin/codes', { headers: adminHeaders() })).json()) as AdminListCodesResponse
    expect(list.codes.find((c) => c.id === a!.id)!.status).toBe('expired')
    expect(list.codes.find((c) => c.id === b!.id)!.status).toBe('exhausted')
  })
})

// ---------------------------------------------------------------- Cloudflare Access JWT

const TEAM = 'agent-lab-test.cloudflareaccess.com'
const AUD = 'aud-0123456789abcdef'

async function makeKeys() {
  const kp = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const jwk = (await crypto.subtle.exportKey('jwk', kp.publicKey)) as JsonWebKey
  return { kp, jwk: { ...jwk, kid: 'kid-1', alg: 'RS256' } }
}

async function signJwt(key: CryptoKey, claims: Record<string, unknown>, kid = 'kid-1'): Promise<string> {
  const enc = new TextEncoder()
  const h = base64url(enc.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })))
  const p = base64url(enc.encode(JSON.stringify(claims)))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${h}.${p}`)))
  return `${h}.${p}.${base64url(sig)}`
}

describe('Cloudflare Access JWT', () => {
  it('verifies RS256 JWTs against the team JWKS (aud, iss, exp) and caches keys', async () => {
    clearJwksCache()
    const { kp, jwk } = await makeKeys()
    let fetches = 0
    const fakeFetch = async (url: string) => {
      fetches++
      expect(url).toBe(`https://${TEAM}/cdn-cgi/access/certs`)
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } })
    }
    const now = Date.now()
    const good = { aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(now / 1000) + 600, email: 'admin@example.com' }
    expect(await verifyAccessJwt(await signJwt(kp.privateKey, good), TEAM, AUD, now, fakeFetch)).toMatchObject({ email: 'admin@example.com' })
    expect(await verifyAccessJwt(await signJwt(kp.privateKey, { ...good, aud: ['other'] }), TEAM, AUD, now, fakeFetch)).toBeNull()
    expect(await verifyAccessJwt(await signJwt(kp.privateKey, { ...good, iss: 'https://evil.cloudflareaccess.com' }), TEAM, AUD, now, fakeFetch)).toBeNull()
    expect(await verifyAccessJwt(await signJwt(kp.privateKey, { ...good, exp: Math.floor(now / 1000) - 3600 }), TEAM, AUD, now, fakeFetch)).toBeNull()
    expect(fetches).toBe(1) // cached

    // Wrong signer.
    const other = await makeKeys()
    expect(await verifyAccessJwt(await signJwt(other.kp.privateKey, good), TEAM, AUD, now, fakeFetch)).toBeNull()
    // Tampered payload.
    const jwt = await signJwt(kp.privateKey, good)
    const [h, , s] = jwt.split('.')
    const forged = `${h}.${base64url(new TextEncoder().encode(JSON.stringify({ ...good, email: 'x@evil' })))}.${s}`
    expect(await verifyAccessJwt(forged, TEAM, AUD, now, fakeFetch)).toBeNull()
    // alg=none.
    const none = `${base64url(new TextEncoder().encode('{"alg":"none","kid":"kid-1"}'))}.${jwt.split('.')[1]}.`
    expect(await verifyAccessJwt(none, TEAM, AUD, now, fakeFetch)).toBeNull()
  })

  it('admin routes accept a valid Cf-Access-Jwt-Assertion when Access is configured', async () => {
    clearJwksCache()
    const { kp, jwk } = await makeKeys()
    const fakeFetch = async () => new Response(JSON.stringify({ keys: [jwk] }))
    const overrides = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }
    const jwt = await signJwt(kp.privateKey, { aud: AUD, iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600, email: 'a@b.c' })
    const ok = await callWith(overrides, '/api/admin/codes', { headers: { 'Cf-Access-Jwt-Assertion': jwt } }, fakeFetch)
    expect(ok.status).toBe(200)
    const bad = await callWith(overrides, '/api/admin/codes', { headers: { 'Cf-Access-Jwt-Assertion': jwt.slice(0, -4) + 'AAAA' } }, fakeFetch)
    await expectError(bad, 401, 'unauthorized')
    // Without Access configured, the header alone is not enough.
    await expectError(await callWith({}, '/api/admin/codes', { headers: { 'Cf-Access-Jwt-Assertion': jwt } }, fakeFetch), 401, 'unauthorized')
  })
})
