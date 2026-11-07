import { describe, expect, it } from "vitest";
import { SSEDecoder, readSSE, type SSEMessage } from "../../src/core/sse.js";

function decodeAll(chunks: string[]): SSEMessage[] {
  const d = new SSEDecoder();
  const out: SSEMessage[] = [];
  for (const c of chunks) out.push(...d.push(c));
  out.push(...d.end());
  return out;
}

describe("SSEDecoder", () => {
  it("decodes event, id and data", () => {
    expect(decodeAll(['event: snapshot\nid: 4\ndata: {"a":1}\n\n'])).toEqual([
      { event: "snapshot", id: "4", data: '{"a":1}', retry: undefined },
    ]);
  });

  it("defaults the event name to message", () => {
    expect(decodeAll(["data: x\n\n"])[0]!.event).toBe("message");
  });

  it("joins multi-line data with newlines", () => {
    expect(decodeAll(["data: a\ndata: b\ndata:\n\n"])[0]!.data).toBe("a\nb\n");
  });

  it("strips exactly one leading space after the colon", () => {
    expect(decodeAll(["data:  two\n\n"])[0]!.data).toBe(" two");
    expect(decodeAll(["data:none\n\n"])[0]!.data).toBe("none");
  });

  it("accepts LF, CR and CRLF line endings", () => {
    for (const nl of ["\n", "\r", "\r\n"]) {
      const msgs = decodeAll([`event: e${nl}data: 1${nl}${nl}data: 2${nl}${nl}`]);
      expect(
        msgs.map((m) => m.data),
        JSON.stringify(nl),
      ).toEqual(["1", "2"]);
    }
  });

  it("treats a CRLF split across chunks as one line ending", () => {
    const msgs = decodeAll(["data: a\r", "\ndata: b\r", "\n\r", "\n"]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.data).toBe("a\nb");
  });

  it("ignores comments, including the server's padded prelude", () => {
    const prelude = `: connected\n:${" ".repeat(2048)}\n\n`;
    expect(decodeAll([prelude + "data: x\n\n"]).map((m) => m.data)).toEqual(["x"]);
  });

  it("strips a leading byte order mark", () => {
    expect(decodeAll(["﻿data: x\n\n"])[0]!.data).toBe("x");
  });

  it("ignores an id containing NUL", () => {
    expect(decodeAll(["id: 1\0\ndata: x\n\n"])[0]!.id).toBeUndefined();
  });

  it("does not dispatch a block without data, but remembers retry", () => {
    const d = new SSEDecoder();
    expect(d.push("retry: 1000\nevent: x\nid: 3\n\n")).toEqual([]);
    expect(d.retryMs).toBe(1000);
    expect(d.push("data: y\n\n")[0]).toEqual({
      event: "message",
      data: "y",
      id: undefined,
      retry: 1000,
    });
  });

  it("ignores an invalid retry and unknown fields", () => {
    const d = new SSEDecoder();
    d.push("retry: soon\nfoo: bar\ndata: x\n\n");
    expect(d.retryMs).toBeUndefined();
  });

  it("does not leak id or event into the next message", () => {
    const msgs = decodeAll(["event: a\nid: 1\ndata: x\n\ndata: y\n\n"]);
    expect(msgs[1]).toEqual({ event: "message", data: "y", id: undefined, retry: undefined });
  });

  it("discards a trailing message without its blank line", () => {
    expect(decodeAll(["data: done\n\ndata: partial\n"]).map((m) => m.data)).toEqual(["done"]);
  });

  it("produces identical output for any chunking", () => {
    const wire =
      `: connected\n:${" ".repeat(100)}\n\n` +
      'event: snapshot\ndata: {"run":{"id":"r","status":"running"}}\n\n' +
      'event: node.output.delta\r\nid: 7\r\ndata: {"text":"héllo 👋"}\r\n\r\n' +
      "retry: 1000\nevent: reconnect\nid: 7\ndata: {}\n\n";
    const expected = decodeAll([wire]);
    expect(expected).toHaveLength(3);
    for (let seed = 1; seed <= 200; seed++) {
      let x = seed;
      const chunks: string[] = [];
      let i = 0;
      while (i < wire.length) {
        x = (x * 1103515245 + 12345) % 2 ** 31;
        const n = 1 + (x % 9);
        chunks.push(wire.slice(i, i + n));
        i += n;
      }
      expect(decodeAll(chunks), `seed ${seed}`).toEqual(expected);
    }
  });
});

describe("readSSE", () => {
  it("decodes multi-byte characters split across byte chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"t":"👋é"}\n\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const b of bytes) controller.enqueue(new Uint8Array([b]));
        controller.close();
      },
    });
    const out: SSEMessage[] = [];
    for await (const m of readSSE(body)) out.push(m);
    expect(JSON.parse(out[0]!.data)).toEqual({ t: "👋é" });
  });

  it("cancels the body when the consumer stops early", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("data: x\n\n"));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const _ of readSSE(body)) break;
    expect(cancelled).toBe(true);
  });
});
