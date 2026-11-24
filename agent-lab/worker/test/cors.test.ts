import { describe, expect, it } from 'vitest'
import { ORIGIN, api, auth, expectError, newSession } from './helpers'

describe('CORS', () => {
  it('allowed origin gets ACAO + Vary: Origin', async () => {
    const res = await api('/api/health', { headers: { Origin: ORIGIN } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Vary')).toMatch(/Origin/)
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull()
  })

  it('preflight for an allowed origin', async () => {
    const res = await api('/api/agent', {
      method: 'OPTIONS',
      headers: { Origin: 'https://workszop.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://workszop.github.io')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/Authorization/)
    expect(res.headers.get('Access-Control-Allow-Headers')).toMatch(/Content-Type/)
    expect(res.headers.get('Vary')).toMatch(/Origin/)
  })

  it('disallowed origin -> 403 origin_not_allowed (preflight and actual), no ACAO', async () => {
    const pre = await api('/api/agent', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } })
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull()
    await expectError(pre, 403, 'origin_not_allowed')

    const { token } = await newSession()
    const res = await api('/api/session', { headers: auth(token, { Origin: 'https://evil.example' }) })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(res.headers.get('Vary')).toMatch(/Origin/)
    await expectError(res, 403, 'origin_not_allowed')
    // Exact match only: no prefix / suffix tricks.
    await expectError(await api('/api/health', { headers: { Origin: 'http://localhost:5173.evil.example' } }), 403, 'origin_not_allowed')
    await expectError(await api('/api/health', { headers: { Origin: 'null' } }), 403, 'origin_not_allowed')
  })

  it('requests without Origin pass CORS but still need auth', async () => {
    expect((await api('/api/health')).status).toBe(200)
    await expectError(await api('/api/session'), 401, 'unauthorized')
  })

  it('errors from allowed origins still carry CORS headers (readable by the app)', async () => {
    const res = await api('/api/session', { headers: { Origin: ORIGIN } })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After')
    await expectError(res, 401, 'unauthorized')
  })
})
