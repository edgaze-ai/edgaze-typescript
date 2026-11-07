import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  APIConnectionError,
  APIUserAbortError,
  AuthenticationError,
  NotFoundError,
  type RunStreamMessage,
} from "../../src/index.js";
import {
  apiError,
  json,
  mockServer,
  RUN_ID,
  sleep,
  snapshot,
  sseFrame,
  startSSE,
  streamEvent,
} from "../helpers/server.js";

/** A run log: lifecycle events go out as `run.status`, the rest under their type, like the server. */
const LOG = [
  streamEvent(1, "run.queued", { status: "pending" }),
  streamEvent(2, "run.started", { status: "running" }),
  streamEvent(3, "node.started", { nodeId: "n1", attempt: 1 }),
  streamEvent(4, "node.output.delta", { nodeId: "n1", attempt: 1, data: { text: "Hel" } }),
  streamEvent(5, "node.output.delta", { nodeId: "n1", attempt: 1, data: { text: "lo" } }),
  streamEvent(6, "node.completed", { nodeId: "n1", attempt: 1 }),
  streamEvent(7, "run.completed", { status: "completed" }),
];

function writeEvent(res: ServerResponse, e: Record<string, unknown>) {
  res.write(
    sseFrame({
      id: e.sequence as number,
      event: e.status ? "run.status" : (e.type as string),
      data: e,
    }),
  );
}

/** Replays events after the client's Last-Event-ID, then the final snapshot, then closes. */
function serveLog(res: ServerResponse, after: number, log = LOG, status = "completed") {
  startSSE(res);
  res.write(sseFrame({ event: "snapshot", data: snapshot("running", after) }));
  for (const e of log) if ((e.sequence as number) > after) writeEvent(res, e);
  res.write(
    sseFrame({ event: "snapshot", data: snapshot(status, log.at(-1)!.sequence as number) }),
  );
  res.end();
}

function lastEventId(headers: Record<string, unknown>): number {
  const v = headers["last-event-id"];
  return typeof v === "string" ? Number(v) : 0;
}

async function collect(iter: AsyncIterable<RunStreamMessage>) {
  const out: RunStreamMessage[] = [];
  for await (const m of iter) out.push(m);
  return out;
}

const seqs = (msgs: RunStreamMessage[]) =>
  msgs.flatMap((m) => (m.kind === "event" ? [m.event.sequence] : []));

describe("runs.stream", () => {
  it("replays the log, yields snapshots and ends after the terminal snapshot", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const stream = server.client().runs.stream(RUN_ID);
    const msgs = await collect(stream);
    expect(msgs[0]).toEqual({ kind: "snapshot", snapshot: snapshot("running", 0) });
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(msgs.at(-1)).toEqual({ kind: "snapshot", snapshot: snapshot("completed", 7) });
    expect(stream.finished).toBe(true);
    expect(stream.lastSequence).toBe(7);
    expect(server.requests).toHaveLength(1);
    const req = server.requests[0]!;
    expect(req.path).toBe(`/v1/runs/${RUN_ID}/stream`);
    expect(req.headers.accept).toBe("text/event-stream");
    expect(req.headers["last-event-id"]).toBeUndefined();
  });

  it("names lifecycle frames run.status and others by type", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    const names = msgs.flatMap((m) => (m.kind === "event" ? [m.name] : []));
    expect(names).toEqual([
      "run.status",
      "run.status",
      "node.started",
      "node.output.delta",
      "node.output.delta",
      "node.completed",
      "run.status",
    ]);
    const text = msgs
      .flatMap((m) =>
        m.kind === "event" && m.event.type === "node.output.delta" ? [m.event.data?.text] : [],
      )
      .join("");
    expect(text).toBe("Hello");
  });

  it("follows a planned roll-over with Last-Event-ID, losing and repeating nothing", async () => {
    const server = await mockServer((req, res, i) => {
      const after = lastEventId(req.headers);
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
        for (const e of LOG.slice(0, 3)) writeEvent(res, e);
        res.write(
          sseFrame({
            retry: 50,
            event: "reconnect",
            id: 3,
            data: { lastSequence: 3, retryMs: 50 },
          }),
        );
        res.end();
        return;
      }
      serveLog(res, after);
    });
    const stream = server.client().runs.stream(RUN_ID);
    const msgs = await collect(stream);
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests).toHaveLength(2);
    expect(server.requests[1]!.headers["last-event-id"]).toBe("3");
    expect(stream.finished).toBe(true);
  });

  it("reconnects after the server's error frame", async () => {
    const server = await mockServer((req, res, i) => {
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
        for (const e of LOG.slice(0, 4)) writeEvent(res, e);
        res.write(sseFrame({ event: "error", data: { error: "Stream failed." } }));
        res.end();
        return;
      }
      serveLog(res, lastEventId(req.headers));
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests[1]!.headers["last-event-id"]).toBe("4");
  });

  it("reconnects after the connection drops mid-stream", async () => {
    const server = await mockServer((req, res, i) => {
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
        for (const e of LOG.slice(0, 2)) writeEvent(res, e);
        res.write('event: node.started\nid: 3\ndata: {"ty'); // cut mid-frame
        setTimeout(() => res.socket?.destroy(), 20);
        return;
      }
      serveLog(res, lastEventId(req.headers));
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests[1]!.headers["last-event-id"]).toBe("2");
  });

  it("reconnects when a connection goes silent past idleTimeout", async () => {
    const server = await mockServer((req, res, i) => {
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
        writeEvent(res, LOG[0]!);
        return; // never writes again
      }
      serveLog(res, lastEventId(req.headers));
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID, { idleTimeout: 200 }));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await server.closed(0); // the dead connection was closed by the client
  });

  it("a slow consumer does not trip the idle timeout", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const seen: number[] = [];
    for await (const m of server.client().runs.stream(RUN_ID, { idleTimeout: 100 })) {
      if (m.kind === "event") seen.push(m.event.sequence);
      await sleep(150); // longer than idleTimeout, with the server silent meanwhile
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests).toHaveLength(1);
  });

  it("pings keep an idle connection alive", async () => {
    const server = await mockServer(async (req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
      for (let k = 0; k < 4; k++) {
        await sleep(80);
        res.write(sseFrame({ event: "ping", data: { t: Date.now() } }));
      }
      for (const e of LOG) writeEvent(res, e);
      res.write(sseFrame({ event: "snapshot", data: snapshot("completed", 7) }));
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID, { idleTimeout: 200 }));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests).toHaveLength(1);
  });

  it("finishes when the public stream has gaps in its sequence numbers", async () => {
    // The public stream omits internal events, so lastEventSequence can exceed every delivered id.
    const gappy = [LOG[0]!, LOG[1]!, streamEvent(9, "run.completed", { status: "completed" })];
    const server = await mockServer((_req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("completed", 12) }));
      for (const e of gappy) writeEvent(res, e);
      res.end();
    });
    const stream = server.client().runs.stream(RUN_ID);
    const msgs = await collect(stream);
    expect(seqs(msgs)).toEqual([1, 2, 9]);
    expect(stream.finished).toBe(true);
    expect(server.requests).toHaveLength(1);
  });

  it("an already finished run replays and ends on the server's clean close", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("failed", 7) }));
      for (const e of LOG.slice(0, 6)) writeEvent(res, e);
      writeEvent(res, streamEvent(7, "run.failed", { status: "failed", reason: "Step failed." }));
      res.end();
    });
    const stream = server.client().runs.stream(RUN_ID);
    const msgs = await collect(stream);
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(stream.snapshot?.run.status).toBe("failed");
    expect(server.requests).toHaveLength(1);
  });

  it("does not stop at a terminal snapshot if the connection dropped before the replay ended", async () => {
    const server = await mockServer((req, res, i) => {
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("completed", 7) }));
        for (const e of LOG.slice(0, 3)) writeEvent(res, e);
        setTimeout(() => res.socket?.destroy(), 20);
        return;
      }
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("completed", 7) }));
      for (const e of LOG)
        if ((e.sequence as number) > lastEventId(req.headers)) writeEvent(res, e);
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(server.requests).toHaveLength(2);
  });

  it("reconnects when the server closes before the run is terminal", async () => {
    const server = await mockServer((req, res, i) => {
      if (i === 0) {
        startSSE(res);
        res.write(sseFrame({ event: "snapshot", data: snapshot("running", 2) }));
        for (const e of LOG.slice(0, 2)) writeEvent(res, e);
        res.end();
        return;
      }
      serveLog(res, lastEventId(req.headers));
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("skips duplicated frames", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
      for (const e of [...LOG.slice(0, 4), LOG[2]!, LOG[3]!, ...LOG.slice(4)]) writeEvent(res, e);
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("ignores ping frames and unknown frames without an id", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("running", 0) }));
      res.write(sseFrame({ event: "ping", data: { t: 1 } }));
      res.write(sseFrame({ event: "future.thing", data: { x: 1 } }));
      for (const e of LOG) writeEvent(res, e);
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(msgs.filter((m) => m.kind === "snapshot")).toHaveLength(1);
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("passes unknown event types through", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      writeEvent(res, streamEvent(1, "node.brand_new", { nodeId: "n" }));
      writeEvent(res, streamEvent(2, "run.completed", { status: "completed" }));
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(msgs[0]).toMatchObject({ kind: "event", name: "node.brand_new" });
  });

  it("starts from afterSequence", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const msgs = await collect(server.client().runs.stream(RUN_ID, { afterSequence: 5 }));
    expect(server.requests[0]!.headers["last-event-id"]).toBe("5");
    expect(seqs(msgs)).toEqual([6, 7]);
  });

  it("rejects an invalid afterSequence", async () => {
    const server = await mockServer((_req, res) => {
      res.end();
    });
    expect(() => server.client().runs.stream(RUN_ID, { afterSequence: -1 })).toThrow(TypeError);
    expect(() => server.client().runs.stream(RUN_ID, { afterSequence: 1.5 })).toThrow(TypeError);
  });

  it("throws API errors that retrying cannot fix", async () => {
    const server = await mockServer((_req, res) => apiError(res, 404, "not_found", "No run."));
    await expect(collect(server.client().runs.stream(RUN_ID))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(server.requests).toHaveLength(1);

    const server2 = await mockServer((_req, res) => apiError(res, 401, "unauthorized", "Bad key."));
    await expect(collect(server2.client().runs.stream(RUN_ID))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("retries a 503 on connect", async () => {
    const server = await mockServer((req, res, i) =>
      i === 0
        ? apiError(res, 503, "internal_error", "x", {}, { "retry-after": "0" })
        : serveLog(res, lastEventId(req.headers)),
    );
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("gives up after maxReconnectAttempts failures in a row", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      res.write(sseFrame({ event: "error", data: { error: "down" } }));
      res.end();
    });
    const err = await collect(
      server.client().runs.stream(RUN_ID, { maxReconnectAttempts: 2 }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(server.requests).toHaveLength(3);
  });

  it("with reconnect: false, ends when the connection ends", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      writeEvent(res, LOG[0]!);
      res.write(
        sseFrame({ event: "reconnect", id: 1, retry: 10, data: { lastSequence: 1, retryMs: 10 } }),
      );
      res.end();
    });
    const stream = server.client().runs.stream(RUN_ID, { reconnect: false });
    const msgs = await collect(stream);
    expect(seqs(msgs)).toEqual([1]);
    expect(stream.finished).toBe(false);
    expect(server.requests).toHaveLength(1);
  });

  it("rejects a response that is not an event stream", async () => {
    const server = await mockServer((_req, res) => json(res, 200, { hello: "world" }));
    const err = await collect(
      server.client().runs.stream(RUN_ID, { maxReconnectAttempts: 0 }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(APIConnectionError);
  });

  it("closes the connection when the consumer breaks out", async () => {
    const server = await mockServer(async (_req, res) => {
      startSSE(res);
      for (let s = 1; s < 1000; s++) {
        if (res.destroyed) return;
        writeEvent(res, streamEvent(s, "node.output.delta", { data: { text: "x" } }));
        await sleep(5);
      }
    });
    for await (const m of server.client().runs.stream(RUN_ID)) {
      if (m.kind === "event" && m.event.sequence === 3) break;
    }
    await server.closed(0);
    expect(server.requests).toHaveLength(1);
  });

  it("abort() stops a waiting stream with APIUserAbortError and closes it", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
      writeEvent(res, LOG[0]!);
    });
    const stream = server.client().runs.stream(RUN_ID);
    const pending = collect(stream);
    await sleep(100);
    stream.abort();
    await expect(pending).rejects.toBeInstanceOf(APIUserAbortError);
    await server.closed(0);
  });

  it("the caller's signal aborts the stream", async () => {
    const server = await mockServer((_req, res) => {
      startSSE(res);
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await expect(
      collect(server.client().runs.stream(RUN_ID, { signal: controller.signal })),
    ).rejects.toBeInstanceOf(APIUserAbortError);
  });

  it("can only be iterated once", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const stream = server.client().runs.stream(RUN_ID);
    await collect(stream);
    expect(() => stream[Symbol.asyncIterator]()).toThrow(/once/);
  });

  it("finalSnapshot drains the stream", async () => {
    const server = await mockServer((req, res) => serveLog(res, lastEventId(req.headers)));
    const snap = await server.client().runs.stream(RUN_ID).finalSnapshot();
    expect(snap?.run.status).toBe("completed");
  });

  it("survives many roll-overs on a long run", async () => {
    const total = 60;
    const log = Array.from({ length: total }, (_, k) =>
      k === total - 1
        ? streamEvent(total, "run.completed", { status: "completed" })
        : streamEvent(k + 1, "node.output.delta", { data: { text: String(k + 1) } }),
    );
    const server = await mockServer((req, res) => {
      const after = lastEventId(req.headers);
      startSSE(res);
      res.write(sseFrame({ event: "snapshot", data: snapshot("running", after) }));
      const batch = log.filter((e) => (e.sequence as number) > after).slice(0, 7);
      for (const e of batch) writeEvent(res, e);
      const last = batch.at(-1)!.sequence as number;
      if (last === total) {
        res.write(sseFrame({ event: "snapshot", data: snapshot("completed", total) }));
      } else {
        res.write(
          sseFrame({
            retry: 1,
            event: "reconnect",
            id: last,
            data: { lastSequence: last, retryMs: 1 },
          }),
        );
      }
      res.end();
    });
    const msgs = await collect(server.client().runs.stream(RUN_ID));
    expect(seqs(msgs)).toEqual(log.map((e) => e.sequence));
    expect(server.requests).toHaveLength(Math.ceil(total / 7));
  });
});
