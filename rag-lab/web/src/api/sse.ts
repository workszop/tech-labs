/** Minimal, spec-following parser for `text/event-stream` bodies. */
export interface SseEvent {
  event: string
  data: string
}

export async function* parseSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (done && buffer.length) buffer += '\n'
      let nl: number
      while ((nl = buffer.search(/\r\n|\r|\n/)) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + (buffer.startsWith('\r\n', nl) ? 2 : 1))
        if (line === '') {
          if (data.length) yield { event, data: data.join('\n') }
          event = 'message'
          data = []
        } else if (line.startsWith(':')) {
          // comment / keep-alive
        } else {
          const idx = line.indexOf(':')
          const field = idx < 0 ? line : line.slice(0, idx)
          let val = idx < 0 ? '' : line.slice(idx + 1)
          if (val.startsWith(' ')) val = val.slice(1)
          if (field === 'event') event = val
          else if (field === 'data') data.push(val)
        }
      }
      if (done) {
        if (data.length) yield { event, data: data.join('\n') }
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
