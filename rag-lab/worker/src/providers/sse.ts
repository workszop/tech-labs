/**
 * Minimal, robust Server-Sent Events parser (WHATWG event-stream rules):
 * handles CRLF / CR / LF line endings, multi-line `data:`, comments, chunk
 * boundaries anywhere (including inside multi-byte UTF-8 sequences).
 */
export interface SseMessage {
  event: string
  data: string
}

export async function* parseSse(body: ReadableStream<Uint8Array>, maxEventBytes = 1024 * 1024): AsyncGenerator<SseMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let event = ''
  let data: string[] = []
  let pendingCR = false

  const flushLine = function* (line: string): Generator<SseMessage> {
    if (line === '') {
      if (data.length) yield { event: event || 'message', data: data.join('\n') }
      event = ''
      data = []
      return
    }
    if (line.startsWith(':')) return
    const idx = line.indexOf(':')
    const field = idx === -1 ? line : line.slice(0, idx)
    let value = idx === -1 ? '' : line.slice(idx + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') data.push(value)
    else if (field === 'event') event = value
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      let text = done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (pendingCR && text.startsWith('\n')) text = text.slice(1)
      pendingCR = false
      buf += text
      let start = 0
      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i]
        if (ch === '\n' || ch === '\r') {
          const line = buf.slice(start, i)
          if (ch === '\r') {
            if (i + 1 < buf.length) {
              if (buf[i + 1] === '\n') i++
            } else {
              pendingCR = true
            }
          }
          start = i + 1
          yield* flushLine(line)
        }
      }
      buf = buf.slice(start)
      if (buf.length > maxEventBytes) throw new Error('SSE line too long')
      if (done) {
        if (buf.length) yield* flushLine(buf)
        yield* flushLine('')
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Formats one of our own SSE events. */
export function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}
