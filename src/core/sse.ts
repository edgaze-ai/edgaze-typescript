// A Server-Sent Events decoder that follows the WHATWG "event stream interpretation" rules:
// LF, CR and CRLF line endings, multi-line `data:`, comments, `id:` (ignored when it contains NUL),
// `retry:`, and a leading BOM. It is incremental, so frames are produced as bytes arrive.

export interface SSEMessage {
  /** The `event:` field, or "message" when absent. */
  event: string;
  /** The `data:` lines joined with "\n". */
  data: string;
  /** The `id:` field of this message, or undefined when the message did not carry one. */
  id: string | undefined;
  /** The latest `retry:` value seen on the stream so far, in milliseconds. */
  retry: number | undefined;
}

export class SSEDecoder {
  private buffer = "";
  private data: string[] = [];
  private event = "";
  private id: string | undefined;
  private sawData = false;
  private first = true;
  /** The latest `retry:` value seen, in milliseconds. Sticky across messages, per spec. */
  retryMs: number | undefined;
  private pendingCR = false;

  /** Feeds decoded text and returns the messages it completed. */
  push(chunk: string): SSEMessage[] {
    if (this.first) {
      this.first = false;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    if (this.pendingCR) {
      this.pendingCR = false;
      if (chunk.startsWith("\n")) chunk = chunk.slice(1);
    }
    this.buffer += chunk;
    const out: SSEMessage[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer.charCodeAt(i);
      if (ch !== 10 && ch !== 13) continue;
      const line = this.buffer.slice(start, i);
      if (ch === 13) {
        if (i + 1 < this.buffer.length) {
          if (this.buffer.charCodeAt(i + 1) === 10) i++;
        } else {
          // CR at the end of the chunk: a following LF belongs to this line ending.
          this.pendingCR = true;
        }
      }
      start = i + 1;
      const message = this.line(line);
      if (message) out.push(message);
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  /** Call at end of stream. A message without its terminating blank line is discarded, per spec. */
  end(): SSEMessage[] {
    this.buffer = "";
    this.reset();
    return [];
  }

  private line(line: string): SSEMessage | null {
    if (line === "") return this.dispatch();
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    let field = line;
    let value = "";
    if (colon !== -1) {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }
    switch (field) {
      case "event":
        this.event = value;
        break;
      case "data":
        this.data.push(value);
        this.sawData = true;
        break;
      case "id":
        if (!value.includes("\0")) this.id = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) this.retryMs = Number(value);
        break;
      default:
        break; // Unknown fields are ignored.
    }
    return null;
  }

  private dispatch(): SSEMessage | null {
    // Per spec, a block without any `data:` line dispatches nothing.
    if (!this.sawData) {
      this.reset();
      return null;
    }
    const message: SSEMessage = {
      event: this.event || "message",
      data: this.data.join("\n"),
      id: this.id,
      retry: this.retryMs,
    };
    this.reset();
    return message;
  }

  private reset() {
    this.data = [];
    this.event = "";
    this.id = undefined;
    this.sawData = false;
  }
}

/** Decodes a fetch body into SSE messages. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = body.getReader();
  const text = new TextDecoder();
  const decoder = new SSEDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield* decoder.push(text.decode(value, { stream: true }));
    }
    yield* decoder.push(text.decode());
    decoder.end();
  } finally {
    // Releases the connection when the consumer stops early (break/return/throw).
    await reader.cancel().catch(() => {});
  }
}
