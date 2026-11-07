// Live tests against the real Edgaze API.
//
//   EDGAZE_API_KEY=edgaze_sk_live_… npm run test:live
//
// Optional:
//   EDGAZE_BASE_URL            another deployment (defaults to production)
//   EDGAZE_TEST_WORKFLOW_ID    a free workflow to run; otherwise one is picked from the catalog
//   EDGAZE_TEST_INPUTS         JSON inputs for that workflow; otherwise built from its input schema
//   EDGAZE_LIVE_RUNS=0         skip the tests that start runs
//
// Runs are started only on free workflows, at most three per test session.
import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  BadRequestError,
  Edgaze,
  NotFoundError,
  type Run,
  type RunStreamMessage,
  type Workflow,
  type WorkflowInputField,
} from "../../src/index.js";

const apiKey = process.env.EDGAZE_API_KEY;
const baseURL = process.env.EDGAZE_BASE_URL;
const runsEnabled = process.env.EDGAZE_LIVE_RUNS !== "0";
const describeLive = apiKey ? describe : describe.skip;
const MISSING_RUN = "00000000-0000-4000-8000-000000000000";

function client(options: ConstructorParameters<typeof Edgaze>[0] = {}) {
  return new Edgaze({ apiKey, ...(baseURL ? { baseURL } : {}), ...options });
}

describe("live: without a valid key", () => {
  it("a bad key is an AuthenticationError with a request id", async () => {
    const c = new Edgaze({ apiKey: "edgaze_sk_live_invalid", ...(baseURL ? { baseURL } : {}) });
    const err = await c.workflows.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    const e = err as AuthenticationError;
    expect(e.status).toBe(401);
    expect(e.code).toBe("unauthorized");
    expect(e.requestId).toBeTruthy();
  });
});

describeLive("live: reads", () => {
  it("lists the catalog and pages through it", async () => {
    const c = client();
    const first = await c.workflows.list({ limit: 3 });
    expect(first.data.length).toBeGreaterThan(0);
    expect(first.data.length).toBeLessThanOrEqual(3);
    const ids: string[] = [];
    for await (const w of c.workflows.list({ limit: 3 })) {
      ids.push(w.id);
      if (ids.length >= 7) break;
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retrieves a workflow and its versions", async () => {
    const c = client();
    const page = await c.workflows.list({ limit: 1 });
    const id = page.data[0]!.id;
    const { data: workflow, requestId } = await c.workflows.retrieve(id).withResponse();
    expect(workflow.id).toBe(id);
    expect(Array.isArray(workflow.inputSchema)).toBe(true);
    expect(requestId).toBeTruthy();
    const versions = await c.workflows.versions(id);
    expect(typeof versions.updateAvailable).toBe("boolean");
  });

  it("pages runs with the cursor without repeating any", async () => {
    const c = client();
    const ids: string[] = [];
    for await (const run of c.runs.list({ limit: 5 })) {
      ids.push(run.id);
      if (ids.length >= 15) break;
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps a missing run to NotFoundError", async () => {
    const err = await client()
      .runs.retrieve(MISSING_RUN)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).requestId).toBeTruthy();
  });

  it("maps a bad cursor to invalid_cursor", async () => {
    const err = await client()
      .runs.list({ cursor: "not-a-cursor" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestError);
    expect((err as BadRequestError).code).toBe("invalid_cursor");
  });
});

/** Picks a free workflow that is runnable with this key, and builds inputs for it. */
async function pickWorkflow(
  c: Edgaze,
): Promise<{ workflow: Workflow; inputs: Record<string, unknown> }> {
  if (process.env.EDGAZE_TEST_WORKFLOW_ID) {
    const workflow = await c.workflows.retrieve(process.env.EDGAZE_TEST_WORKFLOW_ID);
    const inputs = process.env.EDGAZE_TEST_INPUTS
      ? (JSON.parse(process.env.EDGAZE_TEST_INPUTS) as Record<string, unknown>)
      : buildInputs(workflow.inputSchema);
    return { workflow, inputs };
  }
  let checked = 0;
  for await (const item of c.workflows.list({ runModel: "free", runnableOnly: true, limit: 20 })) {
    if (++checked > 40) break;
    if (!item.apiRunnableNow || item.credentialMode !== "edgaze_hosted") continue;
    const workflow = await c.workflows.retrieve(item.id);
    const fields = workflow.inputSchema;
    // Text-only inputs, so the test can fill them in.
    if (
      fields.length > 3 ||
      fields.some((f) => !["text", "textarea", "dropdown", "number"].includes(f.type))
    ) {
      continue;
    }
    return { workflow, inputs: buildInputs(fields) };
  }
  throw new Error(
    "No free text-input workflow found. Set EDGAZE_TEST_WORKFLOW_ID (and EDGAZE_TEST_INPUTS).",
  );
}

function buildInputs(fields: WorkflowInputField[]): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "dropdown") inputs[f.nodeId] = f.options?.[0]?.value ?? f.defaultValue ?? "";
    else if (f.type === "number") inputs[f.nodeId] = Number(f.defaultValue ?? 1) || 1;
    else
      inputs[f.nodeId] = f.defaultValue || f.placeholder || "A short test sentence about the sea.";
  }
  return inputs;
}

const describeRuns = apiKey && runsEnabled ? describe : describe.skip;

describeRuns("live: runs", () => {
  it("starts a run, replays the same idempotency key, streams it to the end, and agrees with the event log", async () => {
    const c = client();
    const { workflow, inputs } = await pickWorkflow(c);
    const key = `sdk-live-${Date.now()}`;
    const { run: accepted } = await c.runs.create(
      { workflow: workflow.id, inputs },
      { idempotencyKey: key },
    );
    expect(accepted.status).toBe("accepted");

    // Same key, same request: the original run comes back, nothing new starts.
    const { run: replay } = await c.runs.create(
      { workflow: workflow.id, inputs },
      { idempotencyKey: key },
    );
    expect(replay.id).toBe(accepted.id);

    const stream = c.runs.stream(accepted.id);
    const messages: RunStreamMessage[] = [];
    for await (const m of stream) messages.push(m);
    expect(stream.finished).toBe(true);
    expect(messages[0]?.kind).toBe("snapshot");
    const streamed = messages.flatMap((m) => (m.kind === "event" ? [m.event] : []));
    const seqs = streamed.map((e) => e.sequence);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    const terminal = [...streamed].reverse().find((e) => e.status !== undefined);
    expect(["completed", "failed", "cancelled"]).toContain(terminal?.status);

    // The durable log holds the same events.
    const logged: number[] = [];
    for await (const e of c.runs.events(accepted.id, { limit: 50 })) logged.push(e.sequence);
    expect(logged).toEqual(seqs);

    // Resuming mid-way yields exactly the rest.
    if (seqs.length >= 2) {
      const mid = seqs[Math.floor(seqs.length / 2)]!;
      const rest: number[] = [];
      for await (const m of c.runs.stream(accepted.id, { afterSequence: mid })) {
        if (m.kind === "event") rest.push(m.event.sequence);
      }
      expect(rest).toEqual(seqs.filter((s) => s > mid));
    }

    const run: Run = await c.runs.wait(accepted.id, { timeout: 60_000 });
    expect(run.status).toBe(terminal?.status);
    if (run.status === "completed") expect(run.outputs.length).toBeGreaterThan(0);

    const listed = await c.runs.list({ workflow: workflow.id, limit: 10 });
    expect(listed.data.some((r) => r.id === accepted.id)).toBe(true);
  });

  it("cancels a run, which is then never charged", async () => {
    const c = client();
    const { workflow, inputs } = await pickWorkflow(c);
    const { run } = await c.runs.create({ workflow: workflow.id, inputs });
    const cancel = await c.runs.cancel(run.id);
    expect(cancel.id).toBe(run.id);
    const finished = await c.runs.wait(run.id, { timeout: 60_000 });
    if (cancel.cancelRequested) {
      expect(finished.status).toBe("cancelled");
      // Settlement can lag the terminal status by a moment.
      let billing = finished.billingStatus;
      for (let i = 0; i < 10 && billing === "pending"; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        billing = (await c.runs.retrieve(run.id)).billingStatus;
      }
      expect(billing).toBe("not_charged");
    } else {
      // It finished before the cancel landed; cancelling again changes nothing.
      expect((await c.runs.cancel(run.id)).cancelRequested).toBe(false);
    }
  });

  it("rejects inputs the workflow does not have", async () => {
    const c = client();
    const { workflow } = await pickWorkflow(c);
    const err = await c.runs
      .create({ workflow: workflow.id, inputs: { definitely_not_an_input: "x" } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestError);
    expect((err as BadRequestError).code).toBe("invalid_inputs");
  });
});
