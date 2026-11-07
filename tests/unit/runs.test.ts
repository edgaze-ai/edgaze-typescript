import { describe, expect, it, vi } from "vitest";
import { APIUserAbortError, ConflictError, Edgaze, RunWaitTimeoutError } from "../../src/index.js";
import { apiError, json, mockServer, RUN_ID, runBody, WORKFLOW_ID } from "../helpers/server.js";

const accepted = {
  run: {
    id: RUN_ID,
    status: "accepted",
    statusUrl: `https://api.edgaze.ai/v1/runs/${RUN_ID}`,
    eventsUrl: `https://api.edgaze.ai/v1/runs/${RUN_ID}/events`,
    streamUrl: `https://api.edgaze.ai/v1/runs/${RUN_ID}/stream`,
  },
};

describe("runs.create", () => {
  it("posts the body with a generated Idempotency-Key", async () => {
    const server = await mockServer((_req, res) => json(res, 202, accepted));
    const result = await server
      .client()
      .runs.create({ workflow: WORKFLOW_ID, inputs: { topic: "tides" }, version: "v1" });
    expect(result).toEqual(accepted);
    const req = server.requests[0]!;
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/v1/runs");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(req.body)).toEqual({
      workflow: WORKFLOW_ID,
      inputs: { topic: "tides" },
      version: "v1",
    });
    expect(req.headers["idempotency-key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("omits optional fields that were not given and never sends the deprecated alias", async () => {
    const server = await mockServer((_req, res) => json(res, 202, accepted));
    await server.client().runs.create({ workflow: WORKFLOW_ID });
    expect(JSON.parse(server.requests[0]!.body)).toEqual({ workflow: WORKFLOW_ID });
  });

  it("uses a different key per call", async () => {
    const server = await mockServer((_req, res) => json(res, 202, accepted));
    const client = server.client();
    await client.runs.create({ workflow: WORKFLOW_ID });
    await client.runs.create({ workflow: WORKFLOW_ID });
    expect(server.requests[0]!.headers["idempotency-key"]).not.toBe(
      server.requests[1]!.headers["idempotency-key"],
    );
  });

  it("retries a failed start with the same key, so it cannot start twice", async () => {
    const server = await mockServer((_req, res, i) =>
      i < 2
        ? apiError(res, 500, "internal_error", "x", {}, { "retry-after": "0" })
        : json(res, 202, accepted),
    );
    await server.client().runs.create({ workflow: WORKFLOW_ID });
    const keys = server.requests.map((r) => r.headers["idempotency-key"]);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(new Set(server.requests.map((r) => r.body)).size).toBe(1);
  });

  it("retries a dropped connection with the same key", async () => {
    const server = await mockServer((_req, res, i) => {
      if (i === 0) res.socket?.destroy();
      else json(res, 202, accepted);
    });
    await server.client().runs.create({ workflow: WORKFLOW_ID });
    expect(server.requests[0]!.headers["idempotency-key"]).toBe(
      server.requests[1]!.headers["idempotency-key"],
    );
  });

  it("sends a caller-provided key", async () => {
    const server = await mockServer((_req, res) => json(res, 202, accepted));
    await server.client().runs.create({ workflow: WORKFLOW_ID }, { idempotencyKey: "job-42" });
    expect(server.requests[0]!.headers["idempotency-key"]).toBe("job-42");
  });

  it("surfaces idempotency conflicts", async () => {
    const server = await mockServer((_req, res) => apiError(res, 409, "idempotency_conflict"));
    const err = await server
      .client()
      .runs.create({ workflow: WORKFLOW_ID }, { idempotencyKey: "k" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(server.requests).toHaveLength(1);
  });

  it("validates before sending", async () => {
    const server = await mockServer((_req, res) => json(res, 202, accepted));
    const client = server.client();
    expect(() => client.runs.create({ workflow: "" })).toThrow(TypeError);
    expect(() =>
      client.runs.create({ workflow: WORKFLOW_ID }, { idempotencyKey: "x".repeat(256) }),
    ).toThrow(TypeError);
    expect(() => client.runs.create({ workflow: WORKFLOW_ID }, { idempotencyKey: "" })).toThrow(
      TypeError,
    );
    expect(server.requests).toHaveLength(0);
  });
});

describe("runs.retrieve and cancel", () => {
  it("cancels with POST and retries safely", async () => {
    const server = await mockServer((_req, res, i) =>
      i === 0
        ? apiError(res, 503, "cancel_unavailable", "x", {}, { "retry-after": "0" })
        : json(res, 200, { id: RUN_ID, status: "running", cancelRequested: true }),
    );
    const result = await server.client().runs.cancel(RUN_ID);
    expect(result.cancelRequested).toBe(true);
    expect(server.requests.map((r) => [r.method, r.path])).toEqual([
      ["POST", `/v1/runs/${RUN_ID}/cancel`],
      ["POST", `/v1/runs/${RUN_ID}/cancel`],
    ]);
  });
});

describe("runs.list", () => {
  function pageServer(total: number, pageSize: number) {
    const ids = Array.from({ length: total }, (_, k) => `run-${String(k).padStart(3, "0")}`);
    return mockServer((req, res) => {
      const limit = Number(req.query.get("limit") ?? pageSize);
      const cursor = req.query.get("cursor");
      const start = cursor ? Number(cursor.slice(1)) : Number(req.query.get("offset") ?? 0);
      const rows = ids.slice(start, start + limit).map((id) => ({ ...runBody("completed"), id }));
      const hasMore = start + limit < total;
      json(res, 200, {
        runs: rows,
        pagination: {
          offset: cursor ? 0 : start,
          limit,
          hasMore,
          nextCursor: hasMore ? `c${start + limit}` : null,
        },
      });
    });
  }

  it("walks every page with the cursor when iterated", async () => {
    const server = await pageServer(23, 10);
    const seen: string[] = [];
    for await (const run of server.client().runs.list({ limit: 10, status: "completed" })) {
      seen.push(run.id);
    }
    expect(seen).toHaveLength(23);
    expect(new Set(seen).size).toBe(23);
    expect(server.requests.map((r) => r.query.get("cursor"))).toEqual([null, "c10", "c20"]);
    expect(server.requests.every((r) => r.query.get("status") === "completed")).toBe(true);
  });

  it("drops offset once it has a cursor", async () => {
    const server = await pageServer(30, 10);
    const all = [];
    for await (const run of server.client().runs.list({ limit: 10, offset: 5 })) all.push(run);
    expect(all).toHaveLength(25);
    expect(server.requests[0]!.query.get("offset")).toBe("5");
    expect(server.requests[1]!.query.has("offset")).toBe(false);
    expect(server.requests[1]!.query.get("cursor")).toBe("c15");
  });

  it("returns one page when awaited, with manual paging helpers", async () => {
    const server = await pageServer(15, 10);
    const page = await server.client().runs.list({ limit: 10 });
    expect(page.data).toHaveLength(10);
    expect(page.body.pagination.nextCursor).toBe("c10");
    expect(page.hasNextPage()).toBe(true);
    const next = await page.getNextPage();
    expect(next.data).toHaveLength(5);
    expect(next.hasNextPage()).toBe(false);
    await expect(next.getNextPage()).rejects.toThrow(/No next page/);
    expect(server.requests).toHaveLength(2);
  });

  it("stops paging when a page reports hasMore without a cursor", async () => {
    const server = await mockServer((_req, res) =>
      json(res, 200, {
        runs: [runBody("completed")],
        pagination: { offset: 0, limit: 1, hasMore: true, nextCursor: null },
      }),
    );
    const all = [];
    for await (const run of server.client().runs.list()) all.push(run);
    expect(all).toHaveLength(1);
  });

  it("iterPages yields each page", async () => {
    const server = await pageServer(5, 2);
    const page = await server.client().runs.list({ limit: 2 });
    const sizes = [];
    for await (const p of page.iterPages()) sizes.push(p.data.length);
    expect(sizes).toEqual([2, 2, 1]);
  });
});

describe("runs.events", () => {
  it("follows nextAfterSequence until hasMore is false", async () => {
    const server = await mockServer((req, res) => {
      const after = Number(req.query.get("afterSequence") ?? 0);
      const limit = Number(req.query.get("limit") ?? 500);
      const events = Array.from({ length: Math.min(limit, 12 - after) }, (_, k) => ({
        type: "node.output.delta",
        sequence: after + k + 1,
        ts: "2026-11-07T10:00:00.000Z",
        nodeId: "n",
        attempt: 1,
        data: { text: String(after + k + 1) },
      }));
      const last = events.at(-1)?.sequence ?? after;
      json(res, 200, {
        id: RUN_ID,
        events,
        hasMore: last < 12,
        nextAfterSequence: last < 12 ? last : null,
      });
    });
    const seqs: number[] = [];
    for await (const e of server.client().runs.events(RUN_ID, { limit: 5 })) seqs.push(e.sequence);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(server.requests.map((r) => r.query.get("afterSequence"))).toEqual([null, "5", "10"]);
    expect(server.requests[0]!.path).toBe(`/v1/runs/${RUN_ID}/events`);
  });
});

describe("runs.wait", () => {
  function fakeClient(statuses: string[]) {
    let i = 0;
    const fetch = vi.fn(async () => {
      const status = statuses[Math.min(i++, statuses.length - 1)]!;
      return new Response(JSON.stringify(runBody(status)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    return { client: new Edgaze({ apiKey: "k", baseURL: "https://x.test/v1", fetch }), fetch };
  }

  it("polls until terminal, growing the interval, and reports progress", async () => {
    vi.useFakeTimers();
    try {
      const { client, fetch } = fakeClient(["pending", "running", "running", "completed"]);
      const polled: string[] = [];
      const promise = client.runs.wait(RUN_ID, { onPoll: (r) => polled.push(r.status) });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(fetch).toHaveBeenCalledTimes(1); // never faster than once a second
      await vi.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1500);
      expect(fetch).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(2250);
      const run = await promise;
      expect(run.status).toBe("completed");
      expect(polled).toEqual(["pending", "running", "running"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns failed and cancelled runs instead of throwing", async () => {
    for (const status of ["failed", "cancelled"]) {
      const { client } = fakeClient([status]);
      expect((await client.runs.wait(RUN_ID)).status).toBe(status);
    }
  });

  it("does not poll faster than once a second even if asked", async () => {
    vi.useFakeTimers();
    try {
      const { client, fetch } = fakeClient(["running", "completed"]);
      const promise = client.runs.wait(RUN_ID, { pollInterval: 10, maxPollInterval: 10 });
      await vi.advanceTimersByTimeAsync(500);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(500);
      await promise;
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws RunWaitTimeoutError after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const { client } = fakeClient(["running"]);
      const promise = client.runs.wait(RUN_ID, { timeout: 3000 }).catch((e) => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const err = await promise;
      expect(err).toBeInstanceOf(RunWaitTimeoutError);
      expect((err as RunWaitTimeoutError).runId).toBe(RUN_ID);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops when aborted", async () => {
    vi.useFakeTimers();
    try {
      const { client } = fakeClient(["running"]);
      const controller = new AbortController();
      const promise = client.runs.wait(RUN_ID, { signal: controller.signal }).catch((e) => e);
      await vi.advanceTimersByTimeAsync(1500);
      controller.abort();
      expect(await promise).toBeInstanceOf(APIUserAbortError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("createAndWait starts the run and returns the finished run", async () => {
    const server = await mockServer((req, res) =>
      req.method === "POST" ? json(res, 202, accepted) : json(res, 200, runBody("completed")),
    );
    const run = await server
      .client()
      .runs.createAndWait({ workflow: WORKFLOW_ID, inputs: { a: 1 } });
    expect(run.status).toBe("completed");
    expect(run.outputs[0]?.value).toBe("hi");
    expect(server.requests.map((r) => r.method)).toEqual(["POST", "GET"]);
  });
});
