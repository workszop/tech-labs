import { describe, expect, it } from 'vitest'
import { parseSse } from './sse'

function stream(parts: string[]) {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(c) {
      parts.forEach((p) => c.enqueue(enc.encode(p)))
      c.close()
    },
  })
}

async function collect(parts: string[]) {
  const out = []
  for await (const e of parseSse(stream(parts))) out.push(e)
  return out
}

describe('parseSse', () => {
  it('parses events split across chunks', async () => {
    const evs = await collect(['event: prompt\nda', 'ta: {"a":1}\n\n', ': keep-alive\n\nevent: delta\ndata: {"text":"Hi"}\n\n'])
    expect(evs).toEqual([
      { event: 'prompt', data: '{"a":1}' },
      { event: 'delta', data: '{"text":"Hi"}' },
    ])
  })
  it('handles CRLF, multi-line data and a final event without blank line', async () => {
    const evs = await collect(['data: line1\r\ndata: line2\r\n\r\n', 'event: done\ndata: {}'])
    expect(evs).toEqual([
      { event: 'message', data: 'line1\nline2' },
      { event: 'done', data: '{}' },
    ])
  })
})
