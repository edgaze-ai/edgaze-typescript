// A real HTTP server standing in for the Edgaze API, so tests exercise actual fetch, sockets,
// chunked bodies and aborts rather than a mocked function.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach } from "vitest";
import { Edgaze, type ClientOptions } from "../../src/index.js";

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  body: string;
}

export type Handler = (
  req: RecordedRequest,
  res: ServerResponse,
  index: number,
) => void | Promise<void>;

export interface MockServer {
  baseURL: string;
  requests: RecordedRequest[];
  /** Resolves once the client has closed the connection for request `index`. */
  closed(index: number): Promise<void>;
  client(options?: ClientOptions): Edgaze;
  close(): Promise<void>;
}

const servers: MockServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

export async function mockServer(handler: Handler): Promise<MockServer> {
  const requests: RecordedRequest[] = [];
  const closedWaiters = new Map<number, Promise<void>>();
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const url = new URL(req.url ?? "/", "http://localhost");
    const recorded: RecordedRequest = {
      method: req.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    const index = requests.push(recorded) - 1;
    closedWaiters.set(index, new Promise<void>((resolve) => res.on("close", () => resolve())));
    try {
      await handler(recorded, res, index);
    } catch (err) {
      if (!res.headersSent) res.writeHead(599);
      res.end(String(err));
    }
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${port}/v1`;
  const mock: MockServer = {
    baseURL,
    requests,
    closed: async (index) => {
      for (let i = 0; i < 200 && !closedWaiters.has(index); i++) {
        await new Promise((r) => setTimeout(r, 5));
      }
      await closedWaiters.get(index);
    },
    client: (options = {}) =>
      new Edgaze({ apiKey: "edgaze_sk_live_test", baseURL, maxRetries: 2, ...options }),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
  servers.push(mock);
  return mock;
}

export function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, {
    "content-type": "application/json",
    "x-request-id": `req_${status}`,
    ...headers,
  });
  res.end(JSON.stringify(body));
}

export function apiError(
  res: ServerResponse,
  status: number,
  code: string,
  message = code,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  json(res, status, { error: { code, message, ...extra } }, headers);
}

/** Encodes one SSE frame exactly the way the Edgaze server does (src/server/execution/streaming/sse.ts). */
export function sseFrame(params: {
  event?: string;
  id?: string | number;
  data?: unknown;
  retry?: number;
  comment?: string;
}): string {
  const lines: string[] = [];
  if (params.comment) lines.push(`: ${params.comment}`);
  if (typeof params.retry === "number") lines.push(`retry: ${Math.floor(params.retry)}`);
  if (params.event) lines.push(`event: ${params.event}`);
  if (params.id !== undefined) lines.push(`id: ${params.id}`);
  if (params.data !== undefined) {
    for (const line of JSON.stringify(params.data).split("\n")) lines.push(`data: ${line}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/** The server's padded prelude comment. */
export const SSE_PRELUDE = `: connected\n:${" ".repeat(2048)}\n\n`;

export function startSSE(res: ServerResponse) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "private, no-store, no-transform",
    "x-request-id": "req_stream",
  });
  res.flushHeaders();
  res.write(SSE_PRELUDE);
}

export const RUN_ID = "11111111-1111-4111-8111-111111111111";
export const WORKFLOW_ID = "22222222-2222-4222-8222-222222222222";

export function streamEvent(
  sequence: number,
  type: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type,
    runId: RUN_ID,
    sequence,
    occurredAt: new Date(1_800_000_000_000 + sequence * 1000).toISOString(),
    ...extra,
  };
}

export function snapshot(status: string, lastEventSequence: number) {
  return { run: { id: RUN_ID, status, reason: null, lastEventSequence } };
}

export function runBody(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    status,
    reason: null,
    suspended: status === "suspended",
    workflowId: WORKFLOW_ID,
    workflowVersionId: null,
    startedAt: "2026-11-07T10:00:00.000Z",
    completedAt: ["completed", "failed", "cancelled"].includes(status)
      ? "2026-11-07T10:00:05.000Z"
      : null,
    displayedChargeUsd: status === "completed" ? 0.012345 : null,
    billingStatus: status === "completed" ? "settled" : "pending",
    outcome: status === "completed" ? "completed" : null,
    queue: null,
    outputs:
      status === "completed" ? [{ nodeId: "out", name: "Result", type: "text", value: "hi" }] : [],
    ...extra,
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
