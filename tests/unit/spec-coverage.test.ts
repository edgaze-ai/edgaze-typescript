// Ties the SDK to the OpenAPI document it was generated from. When Edgaze adds an endpoint, a
// query parameter or a webhook event, `npm run spec:pull` brings in the new document and these
// tests fail until the SDK covers it.
import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  OPENAPI_VERSION,
  type Edgaze,
  type Run,
  type RunEventType,
  type WebhookEvent,
  type Workflow,
} from "../../src/index.js";
import { json, mockServer, RUN_ID, sseFrame, startSSE, WORKFLOW_ID } from "../helpers/server.js";

interface Operation {
  method: string;
  path: string;
  operationId: string;
  queryParams: string[];
}

const spec = JSON.parse(readFileSync(new URL("../../spec/openapi.json", import.meta.url), "utf8"));
const operations: Operation[] = Object.entries(
  spec.paths as Record<
    string,
    Record<string, { operationId: string; parameters?: { in: string; name: string }[] }>
  >,
).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(([m]) => ["get", "post", "put", "patch", "delete"].includes(m))
    .map(([method, op]) => ({
      method: method.toUpperCase(),
      path,
      operationId: op.operationId,
      queryParams: (op.parameters ?? []).filter((p) => p.in === "query").map((p) => p.name),
    })),
);

/** How the SDK calls each operation, with every optional parameter set. */
const SDK_CALLS: Record<string, (c: Edgaze) => Promise<unknown>> = {
  listWorkflows: (c) =>
    c.workflows.list({
      scope: "marketplace",
      q: "q",
      offset: 1,
      limit: 2,
      sort: "newest",
      runModel: "free",
      runnableOnly: true,
    }),
  getWorkflow: (c) => c.workflows.retrieve(WORKFLOW_ID),
  listWorkflowVersions: (c) => c.workflows.versions(WORKFLOW_ID),
  acceptWorkflowUpdate: (c) => c.workflows.acceptUpdate(WORKFLOW_ID),
  listRuns: async (c) => {
    await c.runs.list({ status: "running", workflow: WORKFLOW_ID, offset: 3, limit: 2 });
    await c.runs.list({ cursor: "abc" });
  },
  createRun: (c) => c.runs.create({ workflow: WORKFLOW_ID, inputs: {}, version: "v" }),
  getRun: (c) => c.runs.retrieve(RUN_ID),
  cancelRun: (c) => c.runs.cancel(RUN_ID),
  listRunEvents: (c) => c.runs.events(RUN_ID, { afterSequence: 1, limit: 10 }),
  streamRun: (c) => c.runs.stream(RUN_ID, { afterSequence: 1 }).finalSnapshot(),
};

/** Query parameters the SDK deliberately sends another way. */
const QUERY_PARAMS_SENT_AS_HEADERS: Record<string, string[]> = {
  // The stream resumes with the standard Last-Event-ID header; afterSequence is its query fallback.
  streamRun: ["afterSequence"],
};

describe("spec coverage", () => {
  it("covers every operation in the OpenAPI document", () => {
    expect(Object.keys(SDK_CALLS).sort()).toEqual(operations.map((o) => o.operationId).sort());
  });

  for (const op of operations) {
    it(`${op.operationId} uses ${op.method} ${op.path} and sends every query parameter`, async () => {
      const call = SDK_CALLS[op.operationId];
      expect(call, `SDK has no method for ${op.operationId}`).toBeDefined();
      const server = await mockServer((req, res) => {
        if (req.path.endsWith("/stream")) {
          startSSE(res);
          res.write(
            sseFrame({
              event: "snapshot",
              data: {
                run: { id: RUN_ID, status: "completed", reason: null, lastEventSequence: 0 },
              },
            }),
          );
          res.end();
          return;
        }
        json(res, 200, {
          workflows: [],
          runs: [],
          events: [],
          pagination: { offset: 0, limit: 1, hasMore: false, nextCursor: null },
          hasMore: false,
          nextAfterSequence: null,
          run: { id: RUN_ID },
        });
      });
      await call!(server.client());
      const expectedPath =
        "/v1" + op.path.replace("{id}", op.path.startsWith("/runs") ? RUN_ID : WORKFLOW_ID);
      expect(server.requests[0]!.method).toBe(op.method);
      expect(server.requests[0]!.path).toBe(expectedPath);
      const sent = new Set(server.requests.flatMap((r) => [...r.query.keys()]));
      const viaHeader = QUERY_PARAMS_SENT_AS_HEADERS[op.operationId] ?? [];
      for (const name of op.queryParams) {
        if (viaHeader.includes(name)) continue;
        expect(sent.has(name), `${op.operationId} never sends ?${name}`).toBe(true);
      }
    });
  }

  it("covers every webhook event type", () => {
    const specEvents = Object.keys(spec.webhooks).sort();
    const runTypes: string[] = spec.components.schemas.WebhookRunEventPayload.properties.type.enum;
    const testType: string = spec.components.schemas.WebhookTestPayload.properties.type.const;
    expect([...runTypes, testType].sort()).toEqual(specEvents);
    expectTypeOf<WebhookEvent["type"]>().toEqualTypeOf<
      "run.completed" | "run.failed" | "run.cancelled" | "webhook.test"
    >();
  });

  it("generated types match the committed document", () => {
    expect(OPENAPI_VERSION).toBe(spec.info.version);
  });

  it("method return types come from the spec", () => {
    expectTypeOf<Awaited<ReturnType<Edgaze["runs"]["retrieve"]>>>().toEqualTypeOf<Run>();
    expectTypeOf<Awaited<ReturnType<Edgaze["workflows"]["retrieve"]>>>().toEqualTypeOf<Workflow>();
    // Event types stay open to values added later.
    expectTypeOf<"some.future.event">().toMatchTypeOf<RunEventType>();
  });
});
