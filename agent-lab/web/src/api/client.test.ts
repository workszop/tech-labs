import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, __setApiBaseForTests, __setTokenForTests, hasSession, localizedErrorMessage, resolveApiBaseUrl } from './client'
import { setSettings } from '@/state/store'
import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'

const quota = { requestsUsed: 1, requestLimit: 10, tokensUsed: 5, tokenLimit: 100, estimatedCostUsd: 0, codeExpiresAt: null }

afterEach(() => {
  vi.unstubAllGlobals()
  __setTokenForTests(null)
  __setApiBaseForTests('http://localhost:8787')
})

describe('API base URL (final fix finding 4)', () => {
  it('uses the configured URL, the localhost default only in development, and nothing in a production build without the variable', () => {
    expect(resolveApiBaseUrl('https://api.example.test/', false)).toBe('https://api.example.test')
    expect(resolveApiBaseUrl('https://api.example.test', true)).toBe('https://api.example.test')
    expect(resolveApiBaseUrl(undefined, true)).toBe('http://localhost:8787')
    expect(resolveApiBaseUrl('', true)).toBe('http://localhost:8787')
    expect(resolveApiBaseUrl(undefined, false)).toBeNull()
    expect(resolveApiBaseUrl('  ', false)).toBeNull()
  })

  it('without a configured server no request is sent and the error says so', async () => {
    __setApiBaseForTests(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.activate('AGT-AAAA')).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('logout when the page is unloaded (final fix finding 5)', () => {
  it('sends a keepalive logout with the bearer header (never the token in the URL) and forgets the token', () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    __setTokenForTests('secret-token')
    api.logoutOnUnload()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://localhost:8787/api/logout')
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' })
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-token')
    expect(hasSession()).toBe(false)
  })

  it('does nothing without a session', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    api.logoutOnUnload()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('api client', () => {
  it('keeps the token in memory and sends it as a bearer header, never in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'secret-token', session: { sessionRef: 'x', label: null, expiresAt: '', capabilities: {}, usage: quota } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await api.activate('AGT-AAAA')
    expect(hasSession()).toBe(true)
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(quota)))
    await api.usage()
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(url).not.toContain('secret-token')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-token')
    expect(init.credentials).toBe('omit')
  })

  it('maps error bodies to ApiError and drops the session on auth errors', async () => {
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'session_expired', message: 'Expired' } }), { status: 401 })))
    await expect(api.usage()).rejects.toMatchObject({ code: 'session_expired' })
    expect(hasSession()).toBe(false)
  })

  it('reports network failures in plain language', async () => {
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const err = await api.usage().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('network')
  })

  it('validates embedding responses', async () => {
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ model: 'm', dimensions: 3, embeddings: [[1, 2]], usage: { inputTokens: 1 }, durationMs: 1, quota }))))
    await expect(api.embed(['a'])).rejects.toMatchObject({ code: 'upstream_bad_response' })
  })
})

describe('error messages follow the language', () => {
  afterEach(() => setSettings({ lang: 'pl' }))

  it('Polish: shows the dictionary text for a known code instead of the English server message', async () => {
    setSettings({ lang: 'pl' })
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'quota_exceeded', message: 'The token budget of this access code is used up.' } }), { status: 402 })))
    const err = await api.usage().catch((e) => e)
    expect(err.code).toBe('quota_exceeded')
    expect(err.message).toBe(pl.shell.errors.byCode.quota_exceeded)
  })

  it('English: keeps the more specific server message', async () => {
    setSettings({ lang: 'en' })
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'quota_exceeded', message: 'The token budget of this access code is used up.' } }), { status: 402 })))
    const err = await api.usage().catch((e) => e)
    expect(err.message).toBe('The token budget of this access code is used up.')
  })

  it('falls back to the server message for a code the dictionary does not know', () => {
    setSettings({ lang: 'pl' })
    expect(localizedErrorMessage('brand_new_code' as never, 'Server text')).toBe('Server text')
    expect(localizedErrorMessage('network')).toBe(pl.shell.errors.byCode.network)
  })

  it('localises network failures', async () => {
    setSettings({ lang: 'pl' })
    __setTokenForTests('t')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const net = await api.usage().catch((e) => e)
    expect(net.message).toBe(pl.shell.errors.byCode.network)
  })

  it('has a text for every error code in both languages', () => {
    expect(Object.keys(pl.shell.errors.byCode).sort()).toEqual(Object.keys(en.shell.errors.byCode).sort())
    for (const v of [...Object.values(pl.shell.errors.byCode), ...Object.values(en.shell.errors.byCode)]) expect(v.length).toBeGreaterThan(0)
  })
})
