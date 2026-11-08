# Edgaze TypeScript SDK

The official TypeScript and JavaScript client for the [Edgaze API](https://www.edgaze.ai/docs/api). Run AI workflows, stream their progress live, and verify webhooks, with types generated from the [OpenAPI document](https://github.com/edgaze-ai/edgaze-openapi).

- Fully typed requests, responses and errors
- Safe automatic retries: starting a run sends an idempotency key, so a retry never starts it twice
- Live run streaming that reconnects on its own without losing or repeating events
- Pagination you can walk with `for await`
- Webhook signature verification
- No runtime dependencies. Tested on Node 18, 20, 22 and 24 and on Deno; it runs anywhere with `fetch` and Web Crypto

## Install

```bash
npm install @edgaze/sdk
```

## Quick start

Create an API key in the [Developer console](https://www.edgaze.ai/developer/keys) and set it as `EDGAZE_API_KEY`.

```ts
import Edgaze from "@edgaze/sdk";

const client = new Edgaze(); // reads EDGAZE_API_KEY

const run = await client.runs.createAndWait({
  workflow: "550e8400-e29b-41d4-a716-446655440000",
  inputs: { topic: "Tides" },
});

if (run.status === "completed") {
  for (const output of run.outputs) console.log(output.name, output.value);
} else {
  console.error(run.status, run.reason);
}
```

Use the SDK on your server. It refuses to run in a browser, because that would expose your API key to every visitor.

## Workflows

```ts
// Search the marketplace. Iterating fetches more pages as needed.
for await (const workflow of client.workflows.list({ q: "invoice", runnableOnly: true })) {
  console.log(workflow.id, workflow.name, workflow.displayedRunPriceUsd);
}

// Your own workflows
const mine = await client.workflows.list({ scope: "mine" });

// Inputs, pricing and an example request
const workflow = await client.workflows.retrieve(workflowId);
for (const field of workflow.inputSchema) {
  console.log(field.nodeId, field.type, field.required);
}
```

Key `inputs` by each field's `nodeId`. `name` is a display label and is not guaranteed to be unique.

## Runs

A run executes asynchronously. `runs.create` returns as soon as Edgaze has accepted it.

```ts
const { run } = await client.runs.create({ workflow: workflowId, inputs: { topic: "Tides" } });

// Wait for it, polling politely (never more than once per second).
const finished = await client.runs.wait(run.id, { timeout: 5 * 60_000 });
```

`runs.wait` returns failed and cancelled runs rather than throwing, so check `status`. If the timeout passes first, it throws `RunWaitTimeoutError`; the run keeps going on Edgaze.

### Stream progress live

```ts
const stream = client.runs.stream(run.id);

for await (const message of stream) {
  if (message.kind === "snapshot") {
    console.log("status:", message.snapshot.run.status);
  } else if (message.event.type === "node.output.delta") {
    process.stdout.write(message.event.data?.text ?? "");
  } else if (message.event.type === "run.queue_position") {
    console.log("waiting for capacity, position", message.event.data?.queue?.position);
  }
}

console.log("finished:", stream.snapshot?.run.status);
```

The stream replays what already happened, then follows new events. Edgaze closes each connection about every five minutes. The SDK reconnects from the last event it received after those planned roll-overs, after dropped connections, and after a connection goes silent. It ends once the run is finished. To read the outputs, call `client.runs.retrieve(run.id)`.

Pass `{ afterSequence }` to start part-way through, `{ signal }` or `stream.abort()` to stop, and `{ reconnect: false }` to handle reconnection yourself.

### Other run operations

```ts
await client.runs.retrieve(runId); // status, reason, charge, outputs
await client.runs.cancel(runId); // cancelled runs are never charged

for await (const event of client.runs.events(runId)) {
  console.log(event.sequence, event.type);
}

for await (const run of client.runs.list({ status: "failed" })) {
  console.log(run.id, run.startedAt);
}
```

### Idempotency

Every `runs.create` call sends an `Idempotency-Key`. The SDK generates one per call, so its own retries are safe. To make retries safe across process restarts too, pass a key you derive from your own job:

```ts
await client.runs.create(
  { workflow: workflowId, inputs },
  { idempotencyKey: `invoice-${invoice.id}` },
);
```

Sending the same key with the same request returns the original run. Sending it with a different request throws a `ConflictError` with code `idempotency_conflict`.

## Pagination

List methods return a promise you can either await or iterate:

```ts
// Every item, across all pages
for await (const run of client.runs.list()) {
  /* … */
}

// One page at a time
let page = await client.runs.list({ limit: 50 });
console.log(page.data.length);
while (page.hasNextPage()) {
  page = await page.getNextPage();
}
```

Run listings use a cursor, so runs created while you page are never repeated or skipped.

## Errors

Every error extends `EdgazeError`. When the API responds with an error, you get an `APIError` subclass carrying the HTTP status, a machine-readable `code` and the request id:

```ts
import { APIError, NotFoundError, RateLimitError } from "@edgaze/sdk";

try {
  await client.runs.retrieve(runId);
} catch (err) {
  if (err instanceof NotFoundError) {
    // 404
  } else if (err instanceof APIError) {
    console.error(err.status, err.code, err.message, err.requestId);
  } else {
    throw err;
  }
}
```

| Status | Class                   | Example codes                                             |
| ------ | ----------------------- | --------------------------------------------------------- |
| 400    | `BadRequestError`       | `invalid_request`, `invalid_inputs`, `invalid_cursor`     |
| 401    | `AuthenticationError`   | `unauthorized`                                            |
| 402    | `PaymentRequiredError`  | `spend_cap_reached`                                       |
| 403    | `PermissionDeniedError` | `insufficient_scope`, `forbidden`, `account_restricted`   |
| 404    | `NotFoundError`         | `not_found`                                               |
| 409    | `ConflictError`         | `idempotency_conflict`, `integration_connection_required` |
| 413    | `PayloadTooLargeError`  | `output_too_large`                                        |
| 429    | `RateLimitError`        | `rate_limited` (see `retryAfterMs`)                       |
| 5xx    | `InternalServerError`   | `internal_error`, `cancel_unavailable`                    |

On `invalid_inputs` and `integration_connection_required`, `err.details` lists the problems. Branch on `code`, not on `message`. New codes can be added at any time, so handle codes you don't recognize by their status.

Errors that never reached the API are `APIConnectionError`, `APIConnectionTimeoutError` (the `timeout` passed) and `APIUserAbortError` (you aborted).

Quote `err.requestId` when you contact support. Successful responses carry it too:

```ts
const { data: run, requestId, response } = await client.runs.retrieve(runId).withResponse();
```

## Retries and timeouts

The SDK retries connection errors, timeouts, and responses with status 408, 425, 429 or 5xx. By default it makes two retries, with exponential backoff that honours `Retry-After`. If the server asks for more than a minute, it throws a `RateLimitError` straight away instead.

```ts
const client = new Edgaze({ maxRetries: 4, timeout: 30_000 });

// Per request
await client.runs.retrieve(runId, { maxRetries: 0, timeout: 5_000, signal: controller.signal });
```

`timeout` is per attempt, in milliseconds, and defaults to 60 seconds.

## Webhooks

Edgaze posts to your endpoint when a run completes, fails or is cancelled. Verify the signature on the raw body before trusting the payload:

```ts
// Next.js route handler (app/api/edgaze/route.ts)
import { unwrapWebhook, WebhookVerificationError } from "@edgaze/sdk";

export async function POST(request: Request) {
  try {
    const { event, deliveryId } = await unwrapWebhook({
      payload: await request.text(),
      headers: request.headers,
      secret: process.env.EDGAZE_WEBHOOK_SECRET!,
    });
    // Store event keyed by deliveryId (retries repeat it), then do the work asynchronously.
    if (event.type === "run.completed") {
      // fetch outputs with client.runs.retrieve(event.runId)
    }
    return new Response(null, { status: 200 });
  } catch (err) {
    if (err instanceof WebhookVerificationError) return new Response(null, { status: 400 });
    throw err;
  }
}
```

With Express, read the body raw: `app.post("/edgaze", express.raw({ type: "application/json" }), handler)` and pass `req.body` (a Buffer) and `req.headers`. The SDK rejects deliveries that were signed more than five minutes ago, to stop replays.

If you construct a client with `webhookSecret` (or set `EDGAZE_WEBHOOK_SECRET`), `client.webhooks.unwrap(body, headers)` does the same thing. To test your handler, `signWebhookPayload({ payload, secret })` produces a valid `edgaze-signature` header.

## Configuration

| Option                    | Default                                         | Description                             |
| ------------------------- | ----------------------------------------------- | --------------------------------------- |
| `apiKey`                  | `EDGAZE_API_KEY`                                | Your API key                            |
| `baseURL`                 | `EDGAZE_BASE_URL` or `https://api.edgaze.ai/v1` | API base URL                            |
| `timeout`                 | `60000`                                         | Per-attempt timeout in milliseconds     |
| `maxRetries`              | `2`                                             | Retries after the first attempt         |
| `defaultHeaders`          | `{}`                                            | Headers sent with every request         |
| `fetch`                   | `globalThis.fetch`                              | Custom fetch (proxies, instrumentation) |
| `webhookSecret`           | `EDGAZE_WEBHOOK_SECRET`                         | Secret for `client.webhooks.unwrap`     |
| `dangerouslyAllowBrowser` | `false`                                         | Allow use in a browser                  |

## Types

Every request and response type is exported, under friendly names (`Run`, `Workflow`, `RunStreamEvent`, `WebhookEvent`, …). The raw generated `paths`, `operations` and `components` are exported too. Enumerations the API may extend, such as event types and error codes, are typed as open unions, so new values do not break your build.

## Versioning

This package follows semver. The Edgaze v1 API only ever adds things, so upgrading within a major version is safe. See the [API versioning policy](https://www.edgaze.ai/docs/api/versioning).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in [SECURITY.md](SECURITY.md).

## License

MIT
