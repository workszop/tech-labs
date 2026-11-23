import { describe, expect, it, vi } from 'vitest'
import type { ChatResponse, EmbeddingsResponse } from '../../shared/api-types'
import { buildChatMessages } from '../../shared/prompt'
import { ApiError } from '../src/http'
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible'
import type { ChatStreamChunk } from '../src/providers/types'
import { PROVIDER_KEY, auth, callWith, expectError, jsonInit, newSession, parseSseText, sampleContext } from './helpers'

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

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(ctl) {
      for (const c of chunks) ctl.enqueue(enc.encode(c))
      ctl.close()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

async function collect(it: AsyncIterable<ChatStreamChunk>): Promise<ChatStreamChunk[]> {
  const out: ChatStreamChunk[] = []
  for await (const c of it) out.push(c)
  return out
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

const messages = buildChatMessages({ question: 'q?', context: sampleContext, mode: 'rag' })
const chatOpts = { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 100 }

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

  it('embeddings: validates shape and dimensions → upstream_bad_response', async () => {
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
    const e429 = await rejectsWith(provider(async () => new Response(leaky, { status: 429 })).chat(messages, chatOpts), 'upstream_unavailable')
    expect(e429.message).toMatch(/rate limit/i)
    await rejectsWith(provider(async () => { throw new TypeError('network down') }).embed(['a']), 'upstream_unavailable')
    await rejectsWith(collect(provider(async () => new Response(leaky, { status: 503 })).chatStream(messages, chatOpts)), 'upstream_unavailable')
  })

  it('timeouts → upstream_timeout (embeddings, chat and streaming)', async () => {
    await rejectsWith(provider(hangingFetch, { embedTimeoutMs: 100 }).embed(['a']), 'upstream_timeout')
    await rejectsWith(provider(hangingFetch, { chatTimeoutMs: 100 }).chat(messages, chatOpts), 'upstream_timeout')
    await rejectsWith(collect(provider(hangingFetch, { chatTimeoutMs: 100 }).chatStream(messages, chatOpts)), 'upstream_timeout')
  })

  it('timeout while the stream is already flowing → upstream_timeout', async () => {
    const enc = new TextEncoder()
    const stalled = async (_u: string, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(ctl) {
          ctl.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'))
          init?.signal?.addEventListener('abort', () => ctl.error(new DOMException('aborted', 'AbortError')))
        },
      })
      return new Response(body)
    }
    await rejectsWith(collect(provider(stalled, { chatTimeoutMs: 150 }).chatStream(messages, chatOpts)), 'upstream_timeout')
  })

  it('non-streaming chat parses content, finish_reason and usage', async () => {
    const fetchImpl = async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://upstream.test/v1/chat/completions')
      const body = JSON.parse(init!.body as string)
      expect(body).toMatchObject({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 100, messages })
      expect(body.stream).toBeUndefined()
      return Response.json({ choices: [{ message: { content: 'Three days [1].' }, finish_reason: 'stop' }], usage: { prompt_tokens: 50, completion_tokens: 5 } })
    }
    expect(await provider(fetchImpl).chat(messages, chatOpts)).toEqual({
      text: 'Three days [1].',
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 5 },
    })
  })

  it('streaming: robust SSE parsing (split chunks, CRLF, comments, split UTF-8) incl. the usage chunk', async () => {
    let sentBody: any
    const full =
      ': keep-alive\r\n\r\n' +
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\r\n\r\n' +
      'data: {"choices":[{"delta":{"content":"Zażółć "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"gęślą [1]"}}]}\n\n' +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
      'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":9,"total_tokens":129}}\n\n' +
      'data: [DONE]\n\n'
    const bytes = new TextEncoder().encode(full)
    // Split into 7-byte pieces → breaks lines, JSON and multi-byte characters.
    const pieces: Uint8Array[] = []
    for (let i = 0; i < bytes.length; i += 7) pieces.push(bytes.slice(i, i + 7))
    const fetchImpl = async (_u: string, init?: RequestInit) => {
      sentBody = JSON.parse(init!.body as string)
      return new Response(new ReadableStream({ start(c) { pieces.forEach((p) => c.enqueue(p)); c.close() } }))
    }
    const out = await collect(provider(fetchImpl).chatStream(messages, chatOpts))
    expect(sentBody).toMatchObject({ stream: true, stream_options: { include_usage: true } })
    expect(out).toEqual([
      { type: 'delta', text: 'Zażółć ' },
      { type: 'delta', text: 'gęślą [1]' },
      { type: 'finish', finishReason: 'stop', usage: { inputTokens: 120, outputTokens: 9 } },
    ])
  })

  it('streaming: garbage chunk → upstream_bad_response; error event → upstream_unavailable', async () => {
    await rejectsWith(collect(provider(async () => sseResponse(['data: {not json}\n\n'])).chatStream(messages, chatOpts)), 'upstream_bad_response')
    await rejectsWith(collect(provider(async () => sseResponse(['data: {"error":{"message":"boom"}}\n\n'])).chatStream(messages, chatOpts)), 'upstream_unavailable')
    await rejectsWith(collect(provider(async () => sseResponse([''])).chatStream(messages, chatOpts)), 'upstream_bad_response')
  })

  it('missing API key fails closed', async () => {
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://upstream.test/v1', apiKey: '', embeddingModel: 'm', chatModel: 'c', embeddingDimensions: 3, embedTimeoutMs: 100, chatTimeoutMs: 100,
      fetch: async () => { throw new Error('must not be called') },
    })
    await rejectsWith(p.embed(['a']), 'upstream_unavailable')
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

  it('embeddings + chat (stream) end-to-end, with provider-reported usage', async () => {
    const { token } = await newSession()
    const fetchImpl = async (url: string, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${PROVIDER_KEY}`)
      if (url.endsWith('/embeddings')) {
        return Response.json({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }], usage: { prompt_tokens: 3 } })
      }
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"Three "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"days [1]."},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":400,"completion_tokens":4}}\n\n',
        'data: [DONE]\n\n',
      ])
    }
    const e = await callWith(OPENAI_ENV, '/api/embeddings', jsonInit('POST', { inputs: ['hello'] }, auth(token)), fetchImpl)
    const eb = (await e.json()) as EmbeddingsResponse
    expect(eb).toMatchObject({ model: 'text-embedding-3-small', dimensions: 4, embeddings: [[0.1, 0.2, 0.3, 0.4]], usage: { inputTokens: 3 } })
    expect(eb.quota.tokensUsed).toBe(3)

    const c = await callWith(
      OPENAI_ENV,
      '/api/chat',
      jsonInit('POST', { question: 'How many days?', context: sampleContext, mode: 'rag' }, auth(token)),
      fetchImpl,
    )
    const events = parseSseText(await c.text())
    expect(events.map((x) => x.event)).toEqual(['prompt', 'delta', 'delta', 'done'])
    expect(events[0]!.data.model).toBe('gpt-4o-mini')
    expect(events[3]!.data.usage).toEqual({ inputTokens: 400, outputTokens: 4 })
    expect(events[3]!.data.quota.tokensUsed).toBe(3 + 404)
  })

  it('upstream failure mid-stream ends with an error event; the token reservation is refunded', async () => {
    const { token } = await newSession()
    const fetchImpl = async () => new Response('{"error":{"message":"overloaded"}}', { status: 500 })
    const res = await callWith(
      OPENAI_ENV,
      '/api/chat',
      jsonInit('POST', { question: 'How many days?', context: sampleContext, mode: 'rag' }, auth(token)),
      fetchImpl,
    )
    const events = parseSseText(await res.text())
    expect(events.map((x) => x.event)).toEqual(['prompt', 'error'])
    expect(events[1]!.data.code).toBe('upstream_unavailable')
    const usage = await (await callWith(OPENAI_ENV, '/api/usage', { headers: auth(token) })).json()
    expect(usage).toMatchObject({ requestsUsed: 1, tokensUsed: 0 })
  })

  it('upstream errors → proper HTTP status for non-streaming requests (502 / 504)', async () => {
    const { token } = await newSession()
    const body = jsonInit('POST', { question: 'q?', context: [], mode: 'no-rag', stream: false }, auth(token))
    await expectError(await callWith(OPENAI_ENV, '/api/chat', body, async () => new Response('x', { status: 500 })), 502, 'upstream_unavailable')
    await expectError(
      await callWith({ ...OPENAI_ENV, CHAT_TIMEOUT_MS: '100' }, '/api/chat', jsonInit('POST', { question: 'q?', context: [], mode: 'no-rag', stream: false }, auth(token)), hangingFetch),
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
      await callWith({ ...OPENAI_ENV, CHAT_MODEL: 'gpt-4.5-preview' }, '/api/chat', jsonInit('POST', { question: 'q', context: [], mode: 'no-rag', stream: false }, auth(token)), async () => {
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
      await callWith(OPENAI_ENV, '/api/chat', jsonInit('POST', { question: 'q', context: [], mode: 'no-rag' }, auth(token)), leaky),
      await callWith(OPENAI_ENV, '/api/chat', jsonInit('POST', { question: 'q', context: [], mode: 'no-rag', stream: false }, auth(token)), leaky),
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
