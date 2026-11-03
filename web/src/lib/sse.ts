export interface SseEvent {
  event: string
  data: string
}

const EVENT_SEPARATOR = /\r?\n\r?\n/
const LINE_SEPARATOR = /\r?\n/

function parseEvent(block: string): SseEvent | null {
  let event = "message"
  const data: string[] = []

  for (const line of block.split(LINE_SEPARATOR)) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart())
  }

  if (data.length === 0) return null

  return { event, data: data.join("\n") }
}

/**
 * Reads a `text/event-stream` body and yields each event as it arrives.
 * EventSource only supports GET, so the POST stream is parsed by hand.
 */
export async function* readSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(EVENT_SEPARATOR)
      buffer = blocks.pop() ?? ""

      for (const block of blocks) {
        const event = parseEvent(block)
        if (event) yield event
      }
    }

    const last = parseEvent(buffer)
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}
