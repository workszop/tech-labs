import { describe, expect, it, vi } from 'vitest'
import type { AgentMessage, EmbeddingsResponse } from '../../shared/api-types'
import { ApiError } from '../src/http'
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible'
import { PROVIDER_KEY, auth, callWith, expectError, jsonInit, newSession } from './helpers'

const KEY = 'sk-unit-test-key'

function provider(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, opts: Partial<{ embedTimeoutMs: number; chatTimeoutMs: number; dims: number }> = {}) {
  return new OpenAICompatibleProvider({
    baseUrl: 'https://upstream.test/v1',
    apiKey: KEY,
    embeddingModel: 'text-embedding-3-small',
    chatModel: 'gpt-4o-mini',
    embeddingDimensions: opts.dims ?? 3,
    embedTimeoutMs: opts.embedTimeoutMs ?? 2000,
    chatTimeoutMs: opts.chatTimeoutMs ?? 2000,
    fetch: fetchImpl,
  })
}

async function rejectsWith(p: Promise<unknown>, code: string): Promise<ApiError> {
  try {
    await p
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe(code)
    return err as ApiError
  }
  throw new Error(`expected rejection with ${code}`)
}

/** Fetch that never answers until aborted. */
const hangingFetch = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })

const messages: AgentMessage[] = [{ role: 'user', content: 'q?' }]
const chatOpts = { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 100, toolChoice: 'auto' as const }
const chatWithTools = (p: OpenAICompatibleProvider) => p.chatWithTools('You are a test assistant.', messages, [], chatOpts)

describe('openai-compatible provider (mocked fetch)', () => {
  it('embeddings: sends model + inputs with the key, returns vectors in index order', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://upstream.test/v1/embeddings')
      expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
      const body = JSON.parse(init!.body as string)
      expect(body).toMatchObject({ model: 'text-embedding-3-small', input: ['a', 'b', 'c'] })
      // Deliberately out of order.
      return Response.json({
        data: [
          { index: 2, embedding: [3, 3, 3] },
          { index: 0, embedding: [1, 1, 1] },
          { index: 1, embedding: [2, 2, 2] },
        ],
        usage: { prompt_tokens: 7 },
      })
    })
    const r = await provider(fetchImpl).embed(['a', 'b', 'c'])
    expect(r.embeddings).toEqual([[1, 1, 1], [2, 2, 2], [3, 3, 3]])
    expect(r.inputTokens).toBe(7)
  })

  it('embeddings: validates shape and dimensions -> upstream_bad_response', async () => {
    const f = (body: unknown) => async () => Response.json(body)
    await rejectsWith(provider(f({ data: [{ index: 0, embedding: [1, 2] }] })).embed(['a']), 'upstream_bad_response')
    await rejectsWith(provider(f({ data: [] })).embed(['a']), 'upstream_bad_response')
    await rejectsWith(provider(f({ data: [{ index: 0, embedding: [1, 'x', 3] }] })).embed(['a']), 'upstream_bad_response')
    await rejectsWith(provider(f({ data: [{ index: 0, embedding: [1, 2, 3] }, { index: 0, embedding: [1, 2, 3] }] })).embed(['a', 'b']), 'upstream_bad_response')
    await rejectsWith(provider(async () => new Response('<html>oops</html>', { status: 200 })).embed(['a']), 'upstream_bad_response')
  })

  it('maps upstream 500 / 429 / network errors to upstream_unavailable without leaking the body', async () => {
    const leaky = JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}`, type: 'server_error' } })
    const e500 = await rejectsWith(provider(async () => new Response(leaky, { status: 500 })).embed(['a']), 'upstream_unavailable')
    expect(e500.message).not.toContain(KEY)
    const e429 = await rejectsWith(chatWithTools(provider(async () => new Response(leaky, { status: 429 }))), 'upstream_unavailable')
    expect(e429.message).toMatch(/rate limit/i)
    await rejectsWith(provider(async () => { throw new TypeError('network down') }).embed(['a']), 'upstream_unavailable')
    const e503 = await rejectsWith(chatWithTools(provider(async () => new Response(leaky, { status: 503 }))), 'upstream_unavailable')
    expect(e503.message).not.toContain(KEY)
  })

  it('timeouts -> upstream_timeout (embeddings and tool chat)', async () => {
    await rejectsWith(provider(hangingFetch, { embedTimeoutMs: 100 }).embed(['a']), 'upstream_timeout')
    await rejectsWith(chatWithTools(provider(hangingFetch, { chatTimeoutMs: 100 })), 'upstream_timeout')
  })

  it('missing API key fails closed', async () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://upstream.test/v1', apiKey: '', embeddingModel: 'm', chatModel: 'c', embeddingDimensions: 3, embedTimeoutMs: 100, chatTimeoutMs: 100,
      fetch: async () => { throw new Error('must not be called') },
    })
    await rejectsWith(p.embed(['a']), 'upstream_unavailable')
    await rejectsWith(chatWithTools(p), 'upstream_unavailable')
  })
})

// ---------------------------------------------------------------- end-to-end through the Worker

const OPENAI_ENV = {
  PROVIDER: 'openai-compatible',
  PROVIDER_BASE_URL: 'https://upstream.test/v1',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  CHAT_MODEL: 'gpt-4o-mini',
  ALLOWED_MODELS: 'text-embedding-3-small,gpt-4o-mini',
  EMBEDDING_DIMENSIONS: '4',
}

describe('Worker with openai-compatible provider', () => {
  it('capabilities reflect the configured provider/models/dims', async () => {
    const { token } = await newSession()
    const res = await callWith(OPENAI_ENV, '/api/session', { headers: auth(token) })
    const info = (await res.json()) as any
    expect(info.capabilities).toMatchObject({ provider: 'openai-compatible', embeddingModel: 'text-embedding-3-small', embeddingDimensions: 4, chatModel: 'gpt-4o-mini' })
  })

  it('embeddings end-to-end, with provider-reported usage', async () => {
    const { token } = await newSession()
    const fetchImpl = async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://upstream.test/v1/embeddings')
      expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${PROVIDER_KEY}`)
      return Response.json({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }], usage: { prompt_tokens: 3 } })
    }
    const e = await callWith(OPENAI_ENV, '/api/embeddings', jsonInit('POST', { inputs: ['hello'] }, auth(token)), fetchImpl)
    const eb = (await e.json()) as EmbeddingsResponse
    expect(eb).toMatchObject({ model: 'text-embedding-3-small', dimensions: 4, embeddings: [[0.1, 0.2, 0.3, 0.4]], usage: { inputTokens: 3 } })
    expect(eb.quota.tokensUsed).toBe(3)
  })

  it('upstream errors -> proper HTTP status for non-streaming requests (502 / 504)', async () => {
    const { token } = await newSession()
    const body = jsonInit('POST', { inputs: ['a'] }, auth(token))
    await expectError(await callWith(OPENAI_ENV, '/api/embeddings', body, async () => new Response('x', { status: 500 })), 502, 'upstream_unavailable')
    await expectError(
      await callWith({ ...OPENAI_ENV, EMBED_TIMEOUT_MS: '100' }, '/api/embeddings', jsonInit('POST', { inputs: ['a'] }, auth(token)), hangingFetch),
      504,
      'upstream_timeout',
    )
    await expectError(
      await callWith(OPENAI_ENV, '/api/embeddings', jsonInit('POST', { inputs: ['a'] }, auth(token)), async () => Response.json({ data: 'nope' })),
      502,
      'upstream_bad_response',
    )
  })

  it('a configured model outside ALLOWED_MODELS fails closed', async () => {
    const { token } = await newSession()
    await expectError(
      await callWith({ ...OPENAI_ENV, CHAT_MODEL: 'gpt-4.5-preview' }, '/api/embeddings', jsonInit('POST', { inputs: ['q'] }, auth(token)), async () => {
        throw new Error('must not be called')
      }),
      400,
      'model_not_allowed',
    )
  })

  it('never leaks PROVIDER_API_KEY in any response body or header', async () => {
    const { token } = await newSession()
    // Upstream echoes the key back in its error body (as some providers do).
    const leaky = async () =>
      new Response(JSON.stringify({ error: { message: `Invalid key ${PROVIDER_KEY}`, key: PROVIDER_KEY } }), { status: 401 })
    const responses: Response[] = [
      await callWith(OPENAI_ENV, '/api/embeddings', jsonInit('POST', { inputs: ['a'] }, auth(token)), leaky),
      await callWith(OPENAI_ENV, '/api/health', {}),
      await callWith(OPENAI_ENV, '/api/session', { headers: auth(token) }),
      await callWith({}, '/api/health', {}),
      await callWith({}, '/api/admin/codes', { headers: { Authorization: 'Bearer test-admin-token-0123456789abcdef' } }),
    ]
    for (const r of responses) {
      const text = await r.text()
      expect(text).not.toContain(PROVIDER_KEY)
      expect(text).not.toContain('SUPERSECRET')
      expect(text).not.toContain('test-pepper')
      expect(text).not.toMatch(/at \w+ \(|\.ts:\d+/) // no stack traces
      expect([...r.headers.values()].join('\n')).not.toContain(PROVIDER_KEY)
    }
  })
})
