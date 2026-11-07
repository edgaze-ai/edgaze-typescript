import { describe, expect, it } from "vitest";
import { PermissionDeniedError } from "../../src/index.js";
import { apiError, json, mockServer, WORKFLOW_ID } from "../helpers/server.js";

function item(n: number) {
  return {
    id: `wf-${n}`,
    name: `Workflow ${n}`,
    description: null,
    ownerHandle: "edgaze",
    edgazeCode: null,
    runModel: "free",
    displayedRunPriceUsd: null,
    pricingExplanation: null,
    userAccess: "free",
    accessLabel: "Free",
    apiRunnableNow: true,
    runsCount: 0,
    credentialMode: "platform",
    requiredProviders: [],
  };
}

describe("workflows", () => {
  it("list walks offset pages using the page size the server applied", async () => {
    const total = 11;
    const server = await mockServer((req, res) => {
      const offset = Number(req.query.get("offset") ?? 0);
      const limit = Math.min(Number(req.query.get("limit") ?? 24), 4); // server caps the size
      const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) =>
        item(offset + k),
      );
      json(res, 200, {
        workflows: rows,
        pagination: { offset, limit, hasMore: offset + rows.length < total },
      });
    });
    const names: string[] = [];
    for await (const w of server.client().workflows.list({ limit: 50, q: "x", scope: "mine" })) {
      names.push(w.name);
    }
    expect(names).toHaveLength(total);
    expect(server.requests.map((r) => r.query.get("offset"))).toEqual([null, "4", "8"]);
    expect(
      server.requests.every((r) => r.query.get("q") === "x" && r.query.get("scope") === "mine"),
    ).toBe(true);
  });

  it("stops on an empty page even if hasMore is true", async () => {
    const server = await mockServer((_req, res) =>
      json(res, 200, { workflows: [], pagination: { offset: 0, limit: 24, hasMore: true } }),
    );
    const all = [];
    for await (const w of server.client().workflows.list()) all.push(w);
    expect(all).toHaveLength(0);
    expect(server.requests).toHaveLength(1);
  });

  it("retrieve, versions and acceptUpdate hit the right routes", async () => {
    const server = await mockServer((req, res) => json(res, 200, { path: req.path }));
    const client = server.client();
    await client.workflows.retrieve(WORKFLOW_ID);
    await client.workflows.versions(WORKFLOW_ID);
    await client.workflows.acceptUpdate(WORKFLOW_ID);
    expect(server.requests.map((r) => [r.method, r.path])).toEqual([
      ["GET", `/v1/workflows/${WORKFLOW_ID}`],
      ["GET", `/v1/workflows/${WORKFLOW_ID}/versions`],
      ["POST", `/v1/workflows/${WORKFLOW_ID}/accept-update`],
    ]);
  });

  it("acceptUpdate surfaces a missing workflow:write scope", async () => {
    const server = await mockServer((_req, res) => apiError(res, 403, "insufficient_scope"));
    const err = await server
      .client()
      .workflows.acceptUpdate(WORKFLOW_ID)
      .catch((e) => e);
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect((err as PermissionDeniedError).code).toBe("insufficient_scope");
  });
});
