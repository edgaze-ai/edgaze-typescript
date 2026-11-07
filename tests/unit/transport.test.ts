import { describe, expect, it, vi } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  Edgaze,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  VERSION,
} from "../../src/index.js";
import { apiError, json, mockServer, RUN_ID, runBody, sleep } from "../helpers/server.js";

describe("requests", () => {
  it("sends auth, accept and user agent headers and parses JSON", async () => {
    const server = await mockServer((_req, res) => json(res, 200, runBody("running")));
    const run = await server.client().runs.retrieve(RUN_ID);
    expect(run.status).toBe("running");
    const req = server.requests[0]!;
    expect(req.method).toBe("GET");
    expect(req.path).toBe(`/v1/runs/${RUN_ID}`);
    expect(req.headers.authorization).toBe("Bearer edgaze_sk_live_test");
    expect(req.headers.accept).toBe("application/json");
    expect(req.headers["user-agent"]).toBe(`edgaze-typescript/${VERSION}`);
    expect(req.headers["content-type"]).toBeUndefined();
    expect(req.headers["x-edgaze-retry-count"]).toBeUndefined();
  });

  it("skips undefined query values and encodes the rest", async () => {
    const server = await mockServer((_req, res) =>
      json(res, 200, { workflows: [], pagination: { offset: 0, limit: 5, hasMore: false } }),
    );
    await server.client().workflows.list({ q: "a&b=c d", limit: 5, runnableOnly: true });
    const q = server.requests[0]!.query;
    expect(q.get("q")).toBe("a&b=c d");
    expect(q.get("limit")).toBe("5");
    expect(q.get("runnableOnly")).toBe("true");
    expect(q.has("scope")).toBe(false);
    expect(q.has("offset")).toBe(false);
  });

  it("encodes path segments so an id cannot change the route", async () => {
    const server = await mockServer((_req, res) => json(res, 200, runBody("running")));
    await server.client().runs.retrieve("../workflows?x=1");
    expect(server.requests[0]!.path).toBe("/v1/runs/..%2Fworkflows%3Fx%3D1");
  });

  it("rejects empty ids before sending anything", async () => {
    const server = await mockServer((_req, res) => json(res, 200, {}));
    expect(() => server.client().runs.retrieve("")).toThrow(TypeError);
    expect(server.requests).toHaveLength(0);
  });

  it("merges default and per-request headers, and null removes one", async () => {
    const server = await mockServer((_req, res) => json(res, 200, runBody("running")));
    const client = server.client({ defaultHeaders: { "X-App": "one", "X-Drop": "x" } });
    await client.runs.retrieve(RUN_ID, { headers: { "X-App": "two", "X-Drop": null } });
    expect(server.requests[0]!.headers["x-app"]).toBe("two");
    expect(server.requests[0]!.headers["x-drop"]).toBeUndefined();
  });

  it("withResponse exposes the raw response and request id", async () => {
    const server = await mockServer((_req, res) =>
      json(res, 200, runBody("running"), { "x-request-id": "sin1::abc" }),
    );
    const { data, response, requestId } = await server
      .client()
      .runs.retrieve(RUN_ID)
      .withResponse();
    expect(data.id).toBe(RUN_ID);
    expect(response.status).toBe(200);
    expect(requestId).toBe("sin1::abc");
  });
});

describe("errors", () => {
  it("maps the error envelope onto a typed error with the request id", async () => {
    const server = await mockServer((_req, res) =>
      apiError(res, 404, "not_found", "Run not found.", {}, { "x-request-id": "bom1::r1" }),
    );
    const err = await server
      .client()
      .runs.retrieve(RUN_ID)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    const e = err as NotFoundError;
    expect(e.status).toBe(404);
    expect(e.code).toBe("not_found");
    expect(e.requestId).toBe("bom1::r1");
    expect(e.message).toBe("404 not_found: Run not found. (request id bom1::r1)");
    expect(server.requests).toHaveLength(1); // 404 is never retried
  });

  it("carries details on invalid_inputs", async () => {
    const details = [{ field: "topic", message: "Required." }];
    const server = await mockServer((_req, res) =>
      apiError(res, 400, "invalid_inputs", "Bad inputs.", { details }),
    );
    const err = (await server
      .client()
      .runs.create({ workflow: "w" })
      .catch((e: unknown) => e)) as BadRequestError;
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.details).toEqual(details);
    expect(server.requests).toHaveLength(1);
  });

  it("keeps unknown error codes instead of failing", async () => {
    const server = await mockServer((_req, res) => apiError(res, 400, "brand_new_code", "New."));
    const err = (await server
      .client()
      .runs.retrieve(RUN_ID)
      .catch((e) => e)) as BadRequestError;
    expect(err.code).toBe("brand_new_code");
  });

  it("handles a non-JSON error body", async () => {
    const server = await mockServer((_req, res) => {
      res.writeHead(401, { "content-type": "text/html" });
      res.end("<html>nope</html>");
    });
    const err = (await server
      .client()
      .runs.retrieve(RUN_ID)
      .catch((e) => e)) as AuthenticationError;
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.code).toBe("unauthorized");
    expect(err.body).toBe("<html>nope</html>");
  });

  it("fails clearly when a success body is not JSON", async () => {
    const server = await mockServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{not json");
    });
    await expect(server.client({ maxRetries: 0 }).runs.retrieve(RUN_ID)).rejects.toBeInstanceOf(
      APIConnectionError,
    );
  });
});

describe("retries", () => {
  it("retries 5xx and then succeeds, counting retries in a header", async () => {
    const server = await mockServer((_req, res, i) =>
      i < 2
        ? apiError(res, 503, "cancel_unavailable", "busy", {}, { "retry-after": "0" })
        : json(res, 200, runBody("running")),
    );
    const run = await server.client().runs.retrieve(RUN_ID);
    expect(run.status).toBe("running");
    expect(server.requests).toHaveLength(3);
    expect(server.requests.map((r) => r.headers["x-edgaze-retry-count"])).toEqual([
      undefined,
      "1",
      "2",
    ]);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    const server = await mockServer((_req, res) =>
      apiError(res, 500, "internal_error", "boom", {}, { "retry-after": "0" }),
    );
    const err = await server
      .client({ maxRetries: 3 })
      .runs.retrieve(RUN_ID)
      .catch((e) => e);
    expect(err).toBeInstanceOf(InternalServerError);
    expect(server.requests).toHaveLength(4);
  });

  it("honours Retry-After on 429", async () => {
    const server = await mockServer((_req, res, i) =>
      i === 0
        ? apiError(res, 429, "rate_limited", "slow down", {}, { "retry-after": "1" })
        : json(res, 200, runBody("running")),
    );
    const started = Date.now();
    await server.client().runs.retrieve(RUN_ID);
    expect(Date.now() - started).toBeGreaterThanOrEqual(950);
    expect(server.requests).toHaveLength(2);
  });

  it("does not wait out a Retry-After longer than a minute", async () => {
    const server = await mockServer((_req, res) =>
      apiError(res, 429, "rate_limited", "later", {}, { "retry-after": "3600" }),
    );
    const err = (await server
      .client()
      .runs.retrieve(RUN_ID)
      .catch((e) => e)) as RateLimitError;
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfterMs).toBe(3_600_000);
    expect(server.requests).toHaveLength(1);
  });

  it("never retries 400, 401, 403, 404 or 409", async () => {
    for (const [status, code] of [
      [400, "invalid_request"],
      [401, "unauthorized"],
      [403, "insufficient_scope"],
      [404, "not_found"],
      [409, "idempotency_conflict"],
    ] as const) {
      const server = await mockServer((_req, res) => apiError(res, status, code));
      await server
        .client()
        .runs.retrieve(RUN_ID)
        .catch(() => {});
      expect(server.requests, `status ${status}`).toHaveLength(1);
    }
  });

  it("maxRetries: 0 disables retries per request", async () => {
    const server = await mockServer((_req, res) =>
      apiError(res, 500, "internal_error", "x", {}, { "retry-after": "0" }),
    );
    await server
      .client()
      .runs.retrieve(RUN_ID, { maxRetries: 0 })
      .catch(() => {});
    expect(server.requests).toHaveLength(1);
  });

  it("retries connection failures with backoff, then throws APIConnectionError", async () => {
    const server = await mockServer((_req, res) => {
      res.socket?.destroy();
    });
    const started = Date.now();
    const err = await server
      .client({ maxRetries: 2 })
      .runs.retrieve(RUN_ID)
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIConnectionError);
    expect(err).not.toBeInstanceOf(APIConnectionTimeoutError);
    expect(server.requests).toHaveLength(3);
    // Backoff of ~0.5s then ~1s (with up to 25% jitter).
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
  });

  it("recovers when a dropped connection succeeds on retry", async () => {
    const server = await mockServer((_req, res, i) => {
      if (i === 0) res.socket?.destroy();
      else json(res, 200, runBody("completed"));
    });
    const run = await server.client().runs.retrieve(RUN_ID);
    expect(run.status).toBe("completed");
  });
});

describe("timeouts and aborts", () => {
  it("times out a slow response", async () => {
    const server = await mockServer(async (_req, res) => {
      await sleep(2000);
      json(res, 200, runBody("running"));
    });
    const err = await server
      .client({ timeout: 100, maxRetries: 0 })
      .runs.retrieve(RUN_ID)
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIConnectionTimeoutError);
    expect((err as Error).message).toContain("100 ms");
  });

  it("retries after a timeout", async () => {
    const server = await mockServer(async (_req, res, i) => {
      if (i === 0) await sleep(1000);
      json(res, 200, runBody("running"));
    });
    const run = await server.client({ timeout: 200, maxRetries: 1 }).runs.retrieve(RUN_ID);
    expect(run.status).toBe("running");
    expect(server.requests).toHaveLength(2);
  });

  it("aborts with the caller's signal and does not retry", async () => {
    const server = await mockServer(async (_req, res) => {
      await sleep(2000);
      json(res, 200, runBody("running"));
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const err = await server
      .client()
      .runs.retrieve(RUN_ID, { signal: controller.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIUserAbortError);
    expect(server.requests).toHaveLength(1);
  });

  it("aborts during a retry wait", async () => {
    const server = await mockServer((_req, res) =>
      apiError(res, 429, "rate_limited", "x", {}, { "retry-after": "30" }),
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const started = Date.now();
    const err = await server
      .client()
      .runs.retrieve(RUN_ID, { signal: controller.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIUserAbortError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("rejects immediately with an already-aborted signal", async () => {
    const server = await mockServer((_req, res) => json(res, 200, {}));
    const err = await server
      .client()
      .runs.retrieve(RUN_ID, { signal: AbortSignal.abort() })
      .catch((e) => e);
    expect(err).toBeInstanceOf(APIUserAbortError);
    expect(server.requests).toHaveLength(0);
  });
});

describe("custom fetch", () => {
  it("uses the provided fetch", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(runBody("running")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new Edgaze({ apiKey: "k", baseURL: "https://example.test/v1", fetch });
    await client.runs.retrieve(RUN_ID);
    expect(fetch).toHaveBeenCalledOnce();
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe(
      `https://example.test/v1/runs/${RUN_ID}`,
    );
  });
});

describe("non-retryable requests", () => {
  it("are sent exactly once, even on a retryable status or a dropped connection", async () => {
    const { Transport } = await import("../../src/core/transport.js");
    for (const handler of [
      (res: import("node:http").ServerResponse) =>
        apiError(res, 503, "internal_error", "x", {}, { "retry-after": "0" }),
      (res: import("node:http").ServerResponse) => res.socket?.destroy(),
    ]) {
      const server = await mockServer((_req, res) => handler(res));
      const transport = new Transport({
        apiKey: "k",
        baseURL: server.baseURL,
        timeout: 5000,
        maxRetries: 3,
        fetch: globalThis.fetch,
        defaultHeaders: {},
        maxRetryAfterMs: 60_000,
        isBrowser: false,
      });
      await transport
        .request({ method: "POST", path: "/not-idempotent", body: {}, retryable: false })
        .catch(() => {});
      expect(server.requests).toHaveLength(1);
    }
  });
});
