// GENERATED from spec/openapi.json by scripts/generate.mjs. Do not edit by hand.
// OpenAPI document version: 1.1.0

export const OPENAPI_VERSION = "1.1.0";

export type paths = {
  "/runs": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List runs
     * @description Return the caller's own runs, newest first. Projected from the indexed run row rather than folded from the event log, so it omits `outputs` and `reason` and reports a suspended run as `running` — read GET /runs/{id} for a single run in full. Page with `cursor`: pass `pagination.nextCursor` until it is null. An `offset` shifts by one row for every run created while you page, so offset paging can repeat or skip runs; a cursor cannot. Rate limiting: reads are not metered per-key today; only POST /runs is (up to 60 per minute is never limited). Reads may become metered without a breaking change, so treat 429 with `Retry-After` as possible on any endpoint and back off rather than polling in a tight loop. For run progress prefer GET /runs/{id}/stream, or poll GET /runs/{id} no more than once per second.
     */
    get: operations["listRuns"];
    put?: never;
    /**
     * Create run
     * @description Start an asynchronous workflow run. Returns 202 with URLs to poll status, read events, and stream progress.
     */
    post: operations["createRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/runs/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get run
     * @description Read the run's canonical status, sanitized failure reason, buyer-facing displayed charge, and outputs. Rate limiting: reads are not metered per-key today; only POST /runs is (up to 60 per minute is never limited). Reads may become metered without a breaking change, so treat 429 with `Retry-After` as possible on any endpoint and back off rather than polling in a tight loop. For run progress prefer GET /runs/{id}/stream, or poll GET /runs/{id} no more than once per second.
     */
    get: operations["getRun"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/runs/{id}/cancel": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Cancel run
     * @description Request cancellation of a run that is still in flight. Idempotent: a run that already reached a terminal state is returned unchanged with `cancelRequested: false`. A run that has not started executing yet is cancelled before this call returns. A run that is executing is stopped asynchronously: the response carries its current status with `cancelRequested: true`, and the run reaches `cancelled` shortly after, with a `run.cancelled` webhook. A cancelled run is never charged to the buyer (`billingStatus` settles to `not_charged`). Requires `run:execute`, not `run:read`, because it changes the run's outcome.
     */
    post: operations["cancelRun"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/runs/{id}/events": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List run events
     * @description Return an ordered, bounded page of durable run lifecycle events. Continue from `nextAfterSequence` while `hasMore` is true. Each event carries a `data` object with the content for its type — most importantly `data.text` on `node.output.delta`, which you concatenate in `sequence` order to reconstruct a node's streamed output. Rate limiting: reads are not metered per-key today; only POST /runs is (up to 60 per minute is never limited). Reads may become metered without a breaking change, so treat 429 with `Retry-After` as possible on any endpoint and back off rather than polling in a tight loop. For run progress prefer GET /runs/{id}/stream, or poll GET /runs/{id} no more than once per second.
     */
    get: operations["listRunEvents"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/runs/{id}/stream": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Stream run
     * @description Server-Sent Events stream of the run's log. Every frame's `data:` is one JSON object, and the `event:` name says which schema it follows (listed in `x-sse-events` on the 200 response). A connection opens with an `event: snapshot` frame (`RunStreamSnapshot`), replays the run's events, then tails new ones. Each event frame's `data` is a `RunStreamEvent` and its `id:` is the event's `sequence`; its `event:` is `run.status` for run lifecycle events and the event type otherwise. `RunStreamEvent` carries the same events as GET /runs/{id}/events in a different envelope (`occurredAt` instead of `ts`, `status`/`reason` at the top level, absent fields omitted). Node output arrives as `node.output.delta` frames whose `data.text` you append in order, so this is the endpoint to build a live progress UI on rather than polling. While idle the server sends `event: ping` every 15 seconds (`RunStreamPing`, no `id:`). When the run ends it sends a final `snapshot` and closes. A connection rolls over about every 5 minutes: it ends with `retry: 1000` and an `event: reconnect` frame (`RunStreamReconnect`) whose `id:` is the last sequence it sent; reconnect with that id as `Last-Event-ID` and nothing is lost or repeated. If the stream fails on the server it sends `event: error` (`RunStreamError`) and closes; reconnect the same way. Ignore `event:` names you do not recognize, and frames without an `id:` never move your resume cursor.
     */
    get: operations["streamRun"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/workflows": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List workflows
     * @description Discover current free and pay-per-run workflows in the paginated marketplace catalog. `scope=mine` returns the caller's current workflows.
     */
    get: operations["listWorkflows"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/workflows/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Get workflow
     * @description Retrieve a single workflow with its input schema, access state, pricing, version visibility, and an example run request.
     */
    get: operations["getWorkflow"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/workflows/{id}/accept-update": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Accept workflow update
     * @description Re-pin the caller's purchase to the workflow's current active version. Requires the `workflow:write` scope (kept out of the default key scopes on purpose). Idempotent: accepting when already on the active version returns 200 with the current pin unchanged. Owner keys do not have a purchase to re-pin and receive 403.
     */
    post: operations["acceptWorkflowUpdate"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/workflows/{id}/versions": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * List workflow versions
     * @description Return the versions the caller is entitled to see for a workflow. Owners see the full history; buyers see the version their pin covers plus the current active version. Also returns the caller's `pinnedVersionId` / `activeVersionId` and an `updateAvailable` flag so integrators can decide whether to POST `/workflows/{id}/accept-update`.
     */
    get: operations["listWorkflowVersions"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type webhooks = {
  "run.cancelled": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Run was cancelled.
     * @description Sent after POST /runs/{id}/cancel or a cancellation from the web UI. A cancelled run is never charged. Delivery is at-least-once. Each attempt has a 5 second timeout; a 5xx, 408, 425, 429, connection error, or timeout is retried with exponential backoff (up to 6 attempts over roughly 9 hours, honouring a longer Retry-After). Any other 4xx or a redirect is treated as a permanent rejection and is not retried. Because an event can therefore arrive more than once, deduplicate on the edgaze-delivery-id header, which is stable across retries (or on the body's `runId` plus `type` when that header is absent). Endpoints are delivered in parallel and ordering is not guaranteed. An endpoint is paused after 15 consecutive deliveries that exhaust every attempt, until it is re-enabled in the developer console. Return 2xx as soon as you have persisted the payload, and do the real work asynchronously.
     */
    post: {
      parameters: {
        query?: never;
        header: {
          /** @description 1-indexed attempt number for this delivery. A value above 1 means an earlier attempt did not return 2xx. */
          "edgaze-attempt": number;
          /** @description UUID of this delivery, repeated byte-for-byte on every retry of the same event. This is the deduplication key: record it once you have processed a delivery and return 2xx without reprocessing if it arrives again. Absent on a manual test delivery and on a rare single-attempt fallback delivery (sent when the delivery could not be queued); neither is retried. Deduplicate those on the body's `runId` plus `type`. */
          "edgaze-delivery-id"?: string;
          /** @description Event type carried by the payload, so a receiver can route the delivery before parsing the body. */
          "edgaze-event": string;
          /** @description Signature of this delivery, formatted `t=<unix seconds>,v1=<hex hmac>`. Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
          "edgaze-signature": string;
          /** @description UUID of the endpoint that this delivery was sent to. Use it to select the right secret when one receiver serves several endpoints. */
          "edgaze-webhook-id": string;
        };
        path?: never;
        cookie?: never;
      };
      /** @description Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
      requestBody?: {
        content: {
          "application/json": components["schemas"]["WebhookRunEventPayload"];
        };
      };
      responses: {
        /** @description Acknowledge receipt. Any 2xx settles the delivery. A 5xx, 408, 425, 429, timeout, or connection error is retried with backoff; any other 4xx or a redirect permanently fails the delivery. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "run.completed": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Run reached the completed state.
     * @description Sent once a run settles successfully, after billing has committed. The body carries no outputs or charge; fetch `runUrl` (GET /runs/{id}) to read them, and `displayedChargeUsd` there is final. Delivery is at-least-once. Each attempt has a 5 second timeout; a 5xx, 408, 425, 429, connection error, or timeout is retried with exponential backoff (up to 6 attempts over roughly 9 hours, honouring a longer Retry-After). Any other 4xx or a redirect is treated as a permanent rejection and is not retried. Because an event can therefore arrive more than once, deduplicate on the edgaze-delivery-id header, which is stable across retries (or on the body's `runId` plus `type` when that header is absent). Endpoints are delivered in parallel and ordering is not guaranteed. An endpoint is paused after 15 consecutive deliveries that exhaust every attempt, until it is re-enabled in the developer console. Return 2xx as soon as you have persisted the payload, and do the real work asynchronously.
     */
    post: {
      parameters: {
        query?: never;
        header: {
          /** @description 1-indexed attempt number for this delivery. A value above 1 means an earlier attempt did not return 2xx. */
          "edgaze-attempt": number;
          /** @description UUID of this delivery, repeated byte-for-byte on every retry of the same event. This is the deduplication key: record it once you have processed a delivery and return 2xx without reprocessing if it arrives again. Absent on a manual test delivery and on a rare single-attempt fallback delivery (sent when the delivery could not be queued); neither is retried. Deduplicate those on the body's `runId` plus `type`. */
          "edgaze-delivery-id"?: string;
          /** @description Event type carried by the payload, so a receiver can route the delivery before parsing the body. */
          "edgaze-event": string;
          /** @description Signature of this delivery, formatted `t=<unix seconds>,v1=<hex hmac>`. Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
          "edgaze-signature": string;
          /** @description UUID of the endpoint that this delivery was sent to. Use it to select the right secret when one receiver serves several endpoints. */
          "edgaze-webhook-id": string;
        };
        path?: never;
        cookie?: never;
      };
      /** @description Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
      requestBody?: {
        content: {
          "application/json": components["schemas"]["WebhookRunEventPayload"];
        };
      };
      responses: {
        /** @description Acknowledge receipt. Any 2xx settles the delivery. A 5xx, 408, 425, 429, timeout, or connection error is retried with backoff; any other 4xx or a redirect permanently fails the delivery. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "run.failed": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Run reached the failed state.
     * @description Sent once a run terminates unsuccessfully. The body's `reason` is the same buyer-safe text as GET /runs/{id}. Delivery is at-least-once. Each attempt has a 5 second timeout; a 5xx, 408, 425, 429, connection error, or timeout is retried with exponential backoff (up to 6 attempts over roughly 9 hours, honouring a longer Retry-After). Any other 4xx or a redirect is treated as a permanent rejection and is not retried. Because an event can therefore arrive more than once, deduplicate on the edgaze-delivery-id header, which is stable across retries (or on the body's `runId` plus `type` when that header is absent). Endpoints are delivered in parallel and ordering is not guaranteed. An endpoint is paused after 15 consecutive deliveries that exhaust every attempt, until it is re-enabled in the developer console. Return 2xx as soon as you have persisted the payload, and do the real work asynchronously.
     */
    post: {
      parameters: {
        query?: never;
        header: {
          /** @description 1-indexed attempt number for this delivery. A value above 1 means an earlier attempt did not return 2xx. */
          "edgaze-attempt": number;
          /** @description UUID of this delivery, repeated byte-for-byte on every retry of the same event. This is the deduplication key: record it once you have processed a delivery and return 2xx without reprocessing if it arrives again. Absent on a manual test delivery and on a rare single-attempt fallback delivery (sent when the delivery could not be queued); neither is retried. Deduplicate those on the body's `runId` plus `type`. */
          "edgaze-delivery-id"?: string;
          /** @description Event type carried by the payload, so a receiver can route the delivery before parsing the body. */
          "edgaze-event": string;
          /** @description Signature of this delivery, formatted `t=<unix seconds>,v1=<hex hmac>`. Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
          "edgaze-signature": string;
          /** @description UUID of the endpoint that this delivery was sent to. Use it to select the right secret when one receiver serves several endpoints. */
          "edgaze-webhook-id": string;
        };
        path?: never;
        cookie?: never;
      };
      /** @description Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
      requestBody?: {
        content: {
          "application/json": components["schemas"]["WebhookRunEventPayload"];
        };
      };
      responses: {
        /** @description Acknowledge receipt. Any 2xx settles the delivery. A 5xx, 408, 425, 429, timeout, or connection error is retried with backoff; any other 4xx or a redirect permanently fails the delivery. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "webhook.test": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Manual test delivery from the developer console.
     * @description A synthetic payload triggered from the Edgaze dashboard to verify a receiver. It is never produced by a real run, so ignore it in production handlers. Unlike run events, a test delivery is a single attempt: it is never queued and never retried.
     */
    post: {
      parameters: {
        query?: never;
        header: {
          /** @description 1-indexed attempt number for this delivery. A value above 1 means an earlier attempt did not return 2xx. */
          "edgaze-attempt": number;
          /** @description UUID of this delivery, repeated byte-for-byte on every retry of the same event. This is the deduplication key: record it once you have processed a delivery and return 2xx without reprocessing if it arrives again. Absent on a manual test delivery and on a rare single-attempt fallback delivery (sent when the delivery could not be queued); neither is retried. Deduplicate those on the body's `runId` plus `type`. */
          "edgaze-delivery-id"?: string;
          /** @description Event type carried by the payload, so a receiver can route the delivery before parsing the body. */
          "edgaze-event": string;
          /** @description Signature of this delivery, formatted `t=<unix seconds>,v1=<hex hmac>`. Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
          "edgaze-signature": string;
          /** @description UUID of the endpoint that this delivery was sent to. Use it to select the right secret when one receiver serves several endpoints. */
          "edgaze-webhook-id": string;
        };
        path?: never;
        cookie?: never;
      };
      /** @description Signed with HMAC-SHA256 over the exact string `{t}.{raw request body}`, using your endpoint secret. Compare in constant time against the raw bytes you received, before JSON parsing: re-serializing the body changes the signature. Reject any delivery whose `t` is more than 300 seconds from your clock, otherwise a captured payload can be replayed indefinitely. */
      requestBody?: {
        content: {
          "application/json": components["schemas"]["WebhookTestPayload"];
        };
      };
      responses: {
        /** @description Acknowledge receipt. Any 2xx settles the delivery. A 5xx, 408, 425, 429, timeout, or connection error is retried with backoff; any other 4xx or a redirect permanently fails the delivery. */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};
export type components = {
  schemas: {
    /** @description The `run` sub-object returned by POST /runs (202 Accepted). */
    AcceptedRun: {
      /**
       * Format: uri
       * @description Absolute URL for GET /runs/{id}/events.
       */
      eventsUrl: string;
      /**
       * Format: uuid
       * @description Run UUID. Use it for every follow-up run call.
       */
      id: string;
      /**
       * @description Always the constant `accepted`. This is an acknowledgement that the run was durably enqueued, not a lifecycle status: it is deliberately NOT a `PublicRunStatus` value, because no execution has happened yet. Read GET /runs/{id} for the real status.
       * @constant
       */
      status: "accepted";
      /**
       * Format: uri
       * @description Absolute URL for GET /runs/{id}.
       */
      statusUrl: string;
      /**
       * Format: uri
       * @description Absolute URL for the SSE stream.
       */
      streamUrl: string;
    };
    /** @description Confirms the buyer's purchase pin was re-pinned to the workflow's current active version. */
    AcceptWorkflowUpdateResponse: {
      /** @constant */
      ok: true;
      /** Format: uuid */
      pinnedVersionId: string;
      /** Format: uuid */
      workflowId: string;
    };
    /**
     * @description Whether the buyer-facing charge for this run is still pending, finalized, or not applicable.
     * @enum {string}
     */
    BillingStatus: "pending" | "settled" | "not_charged";
    /** @description Response body for POST /runs/{id}/cancel. */
    CancelRunResponse: {
      /** @description True when this call initiated the cancellation, false when the run was already in a terminal state and nothing changed. */
      cancelRequested: boolean;
      /** Format: uuid */
      id: string;
      /** @description Status after the cancel request. `cancelled` once the run is torn down; a terminal status is returned unchanged when the run had already finished. */
      status: components["schemas"]["PublicRunStatus"];
    };
    /** @description Request body for POST /runs. */
    CreateRunRequest: {
      /** @description Currently optional for backward compatibility, but strongly recommended for every request. Account-scoped and case-sensitive (max 255 chars). Prefer the `Idempotency-Key` header; when both are set they must match. The fingerprint covers workflow, normalized inputs, and requested version. */
      idempotencyKey?: string;
      /** @description Map of exact input `nodeId` (preferred) or `name` to value, using the keys from the workflow's `inputSchema`. Unknown or ambiguous keys are rejected with 400 `invalid_inputs`. Omit entirely for a workflow that takes no inputs. */
      inputs?: {
        [key: string]: unknown;
      };
      /**
       * Format: uuid
       * @description Optional immutable workflow version to run. When omitted, resolves to the caller's pinned version, or the workflow's active version when there is no pin.
       */
      version?: string;
      /**
       * Format: uuid
       * @description Workflow UUID to run.
       * @example 550e8400-e29b-41d4-a716-446655440000
       */
      workflow?: string;
      /**
       * Format: uuid
       * @deprecated
       * @description Deprecated compatibility alias for `workflow`. Prefer `workflow`. When both are set, `workflow` wins.
       * @example 550e8400-e29b-41d4-a716-446655440000
       */
      workflowId?: string;
    };
    /** @description Response body for POST /runs (202 Accepted). */
    CreateRunResponse: {
      run: components["schemas"]["AcceptedRun"];
    };
    /**
     * @description Whether the workflow runs on Edgaze-hosted credentials or the caller's own keys.
     * @enum {string}
     */
    CredentialMode: "edgaze_hosted" | "byok";
    /**
     * @description Stable, machine-friendly error identifier. Branch on this value; the human `message` may change. Two codes are transport-level rather than operation-specific and so are not listed under any single path: `method_not_allowed` (an HTTP method this route does not implement, returned with an `Allow` header) and `invalid_json` (a request body that is not parseable JSON).
     * @example invalid_inputs
     * @enum {string}
     */
    ErrorCode:
      | "unauthorized"
      | "insufficient_scope"
      | "forbidden"
      | "not_found"
      | "invalid_request"
      | "invalid_json"
      | "invalid_inputs"
      | "missing_workflow"
      | "invalid_cursor"
      | "method_not_allowed"
      | "spend_cap_reached"
      | "idempotency_conflict"
      | "rate_limited"
      | "account_restricted"
      | "integration_connection_required"
      | "creator_listings_paused"
      | "output_too_large"
      | "cancel_unavailable"
      | "internal_error";
    /** @description Per-input failure attached to `invalid_inputs` errors. */
    ErrorDetail: {
      /**
       * @description The offending input key (`nodeId` or exact `name`).
       * @example topic
       */
      input: string;
      /**
       * @description Human-readable explanation of why this input was rejected.
       * @example is required
       */
      message: string;
    };
    /**
     * @description Envelope returned by every non-2xx response from the v1 REST API.
     * @example {
     *       "error": {
     *         "code": "unauthorized",
     *         "message": "Invalid or missing API key."
     *       }
     *     }
     */
    ErrorEnvelope: {
      error: components["schemas"]["ErrorObject"];
    };
    /** @description Inner error body carried by every failure response, discriminated by `code`. Only `invalid_inputs` and `integration_connection_required` carry `details`. */
    ErrorObject:
      | components["schemas"]["InvalidInputsError"]
      | components["schemas"]["IntegrationConnectionRequiredError"]
      | components["schemas"]["PlainError"]
      | components["schemas"]["UnknownError"];
    /** @description A third-party account the caller must connect, attached to `integration_connection_required`. */
    IntegrationConnectionDetail: {
      /**
       * @description Where the account owner connects the service in Edgaze, in a browser.
       * @example https://www.edgaze.ai/settings#gateway
       */
      connectUrl: string;
      /** @description True when the workflow writes to this account, not only reads it. */
      makesChanges: boolean;
      /**
       * @description Display name of the service.
       * @example GitHub
       */
      provider: string;
      /**
       * @description Stable provider id.
       * @example github
       */
      providerId: string;
    };
    /** @description Inner error body for `integration_connection_required`. */
    IntegrationConnectionRequiredError: {
      /** @constant */
      code: "integration_connection_required";
      /** @description Each account the caller must connect before the workflow can run. */
      details: components["schemas"]["IntegrationConnectionDetail"][];
      /**
       * @description Human-readable failure reason. Do not parse; branch on `code` instead.
       * @example Rate limit exceeded. Slow down and retry.
       */
      message: string;
    };
    /** @description Inner error body for `invalid_inputs`. */
    InvalidInputsError: {
      /** @constant */
      code: "invalid_inputs";
      /** @description Each rejected input. Absent when the request was rejected as a whole (for example `inputs` was not an object). */
      details?: components["schemas"]["ErrorDetail"][];
      /**
       * @description Human-readable failure reason. Do not parse; branch on `code` instead.
       * @example Rate limit exceeded. Slow down and retry.
       */
      message: string;
    };
    /** @description Query parameters accepted by GET /runs. */
    ListRunsQuery: {
      /** @description `pagination.nextCursor` from the previous page. Recommended over `offset`, which can repeat or skip runs created while you page. Cannot be combined with `offset`. */
      cursor?: string;
      /** @description Page size (max 50). Defaults to 24. */
      limit?: number;
      /** @description Pagination offset. Defaults to 0. Prefer `cursor`; cannot be combined with it. */
      offset?: number;
      /** @description Return only runs currently in this status. */
      status?: components["schemas"]["RunListStatus"];
      /**
       * Format: uuid
       * @description Return only runs of this workflow.
       */
      workflow?: string;
    };
    /** @description Query parameters accepted by GET /workflows. */
    ListWorkflowsQuery: {
      /** @description Page size (max 50). Defaults to 24. */
      limit?: number;
      /** @description Pagination offset; used with `marketplace` scope. */
      offset?: number;
      /** @description Search title, description, tags, owner handle, or Edgaze Code. */
      q?: string;
      /** @description Filter by pricing model. */
      runModel?: components["schemas"]["RunModel"];
      /**
       * @description When `true`, only workflows the key holder can run right now.
       * @enum {string}
       */
      runnableOnly?: "true" | "false";
      /**
       * @description Marketplace catalog or the key holder's current workflows. Defaults to `marketplace`.
       * @enum {string}
       */
      scope?: "marketplace" | "mine";
      /**
       * @description Marketplace sort order. Defaults to `popular`.
       * @enum {string}
       */
      sort?: "popular" | "newest";
    };
    /** @description Offset-based pagination cursor for list endpoints. */
    Pagination: {
      /** @description True when another page follows this one. */
      hasMore: boolean;
      /** @description Page size actually applied (max 50). */
      limit: number;
      /** @description Offset of the first row in this page. */
      offset: number;
    };
    /** @description Inner error body for codes that carry no `details`. */
    PlainError: {
      /**
       * @description Any code other than `invalid_inputs` and `integration_connection_required`.
       * @enum {string}
       */
      code:
        | "unauthorized"
        | "insufficient_scope"
        | "forbidden"
        | "not_found"
        | "invalid_request"
        | "invalid_json"
        | "missing_workflow"
        | "invalid_cursor"
        | "method_not_allowed"
        | "spend_cap_reached"
        | "idempotency_conflict"
        | "rate_limited"
        | "account_restricted"
        | "creator_listings_paused"
        | "output_too_large"
        | "cancel_unavailable"
        | "internal_error";
      /**
       * @description Human-readable failure reason. Do not parse; branch on `code` instead.
       * @example Rate limit exceeded. Slow down and retry.
       */
      message: string;
    };
    /**
     * @description Canonical run status exposed by the public API.
     * @enum {string}
     */
    PublicRunStatus: "pending" | "running" | "suspended" | "completed" | "failed" | "cancelled";
    /**
     * @description External model provider a BYOK workflow expects the caller to configure.
     * @enum {string}
     */
    RequiredProvider: "openai" | "anthropic" | "google" | "azure_openai" | "vertex" | "openrouter";
    /** @description Response body for GET /runs/{id}. */
    Run: {
      billingStatus: components["schemas"]["BillingStatus"];
      completedAt: string | null;
      /** @description Buyer-facing charge. `null` until the run settles. USD amount as a JSON number with up to six decimal places. Preserve the documented precision and do not round intermediate calculations to two decimal places. */
      displayedChargeUsd: number | null;
      /** Format: uuid */
      id: string;
      outcome: components["schemas"]["RunOutcome"];
      outputs: components["schemas"]["RunOutputField"][];
      /** @description Non-null while the run is `pending` because it is waiting for capacity; null otherwise. */
      queue: components["schemas"]["RunQueue"] | null;
      /** @description Buyer-safe failure explanation. Non-null only when `status` is `failed`; provider-specific detail is deliberately generalized. */
      reason: string | null;
      startedAt: string | null;
      status: components["schemas"]["PublicRunStatus"];
      /** @description True exactly when `status` is `suspended`; kept as a separate flag so a caller can test for 'waiting' without matching on the status enum. A run suspends for one of two reasons, reported as `reason` on the `run.suspended` event: `wait_timer` (a delay node) resumes itself when the timer fires, while `wait_signal` (the workflow needs credentials) waits for the buyer to supply them on the web run page. The API cannot resume a run; POST /runs/{id}/cancel is the only way for an API caller to end one early. */
      suspended: boolean;
      workflowId: string | null;
      workflowVersionId: string | null;
    };
    /** @description One row in the durable run event log. */
    RunEvent: {
      /** @description 1-based execution attempt for node events; `null` for run-level events. */
      attempt: number | null;
      /** @description Event-specific content, or `null` when this event type carries none. */
      data: components["schemas"]["RunEventData"] | null;
      /** @description Workflow node this event belongs to, or `null` for run-level events. On presented runs (workflows the caller did not create) this is an opaque stage id: stable within one run, unrelated across runs and to the workflow's input `nodeId`s. */
      nodeId: string | null;
      /** @description Monotonic, gap-free position in this run's log. Use as the `afterSequence` cursor and to order events. */
      sequence: number;
      /** Format: date-time */
      ts: string;
      /** @description Event name. The listed values are every type emitted today; branch on them. The union stays open to plain strings on purpose, because adding an event type is not a breaking change: ignore values you do not recognize instead of failing. */
      type:
        | (
            | "run.queued"
            | "run.queue_position"
            | "run.preparing"
            | "run.started"
            | "run.suspended"
            | "run.resumed"
            | "run.completed"
            | "run.failed"
            | "run.cancelled"
            | "node.started"
            | "node.output.delta"
            | "node.completed"
            | "node.failed"
            | "node.retry_scheduled"
            | "node.skipped"
          )
        | string;
    };
    /** @description Presented runs only: a customer-facing description of what a stage is doing. */
    RunEventActivity: {
      /** @description Image steps: the picture's shape as `W:H`, e.g. `16:9`. */
      aspect?: string;
      /** @description Public image path of the model or app mark, e.g. `/misc/claude.png`. */
      icon?: string;
      /** @description Kind of work. Known values: `writing`, `thinking`, `image`, `understanding`, `reading`, `watching`, `fetching`, `integration`, `specialist`, `calculating`. Treat unknown values as generic work. */
      kind: string;
      /** @description Customer-facing description of the stage. */
      label: string;
      /** @description Display name of the model, when one runs. */
      model?: string;
      /** @description Repeated stages: which pass this is, and how many when known. */
      pass?: {
        current: number;
        total?: number;
      };
    };
    /** @description Event-specific content, projected to the fields that are safe for the caller. `activity`, `progress`, `isOutput`, `outputLabel` and `output` appear only on presented runs (workflows the caller did not create). */
    RunEventData: {
      activity?: components["schemas"]["RunEventActivity"];
      /**
       * @description Presented runs only: `true` on a stage that produces a result.
       * @constant
       */
      isOutput?: true;
      /** @description Presented runs only: the result's value when it is small enough to inline. GET /runs/{id} always carries the full outputs. */
      output?: unknown;
      /** @description Presented runs only: the name of the result this stage produces. */
      outputLabel?: string;
      progress?: components["schemas"]["RunProgressHint"];
      /** @description Present on `run.queue_position`: the run is waiting for capacity (`state: waiting`, its place in line and an estimated wait) or has just left the line (`state: starting`, position 0). */
      queue?: components["schemas"]["RunQueue"];
      /** @description Why the run failed, suspended, or a node was skipped. Sanitized to the same buyer-safe text as `Run.reason`. */
      reason?: string | null;
      /** @description Run status implied by this event. Present on run lifecycle events. */
      status?: components["schemas"]["PublicRunStatus"];
      /** @description Incremental output text. Present on `node.output.delta`; concatenate in `sequence` order to reconstruct a node's streamed output. */
      text?: string;
    };
    /** @description Response body for GET /runs/{id}/events. */
    RunEventsPage: {
      events: components["schemas"]["RunEvent"][];
      hasMore: boolean;
      /** Format: uuid */
      id: string;
      /** @description Pass as `afterSequence` to fetch the next page. `null` when `hasMore` is false. */
      nextAfterSequence: number | null;
    };
    /**
     * @description UUID returned from POST /runs.
     * @example 7c9e6679-7425-40de-944b-e07fc1f90ae7
     */
    RunIdParam: string;
    /** @description Compact row in the run history. Outputs and failure reasons are omitted here — read GET /runs/{id} for a single run's full detail. */
    RunListItem: {
      billingStatus: components["schemas"]["BillingStatus"];
      completedAt: string | null;
      displayedChargeUsd: number | null;
      /** Format: uuid */
      id: string;
      outcome: components["schemas"]["RunOutcome"];
      startedAt: string | null;
      status: components["schemas"]["RunListStatus"];
      workflowId: string | null;
      workflowVersionId: string | null;
    };
    /** @description Pagination for GET /runs. Prefer `nextCursor`: an offset shifts by one row for every run created while you page, so offset paging can repeat or skip runs; a cursor cannot. */
    RunListPagination: {
      /** @description True when another page follows this one. */
      hasMore: boolean;
      /** @description Page size actually applied (max 50). */
      limit: number;
      /** @description Pass as `cursor` to fetch the next page; `null` when `hasMore` is false. Opaque: do not parse or build it. Present on offset pages too, so you can switch to cursors at any point. */
      nextCursor: string | null;
      /** @description Offset of the first row in this page. Always 0 when the request used `cursor`. */
      offset: number;
    };
    /** @description Response body for GET /runs. */
    RunListResponse: {
      pagination: components["schemas"]["RunListPagination"];
      runs: components["schemas"]["RunListItem"][];
    };
    /**
     * @description Run status as reported by the run list. A suspended run is reported as `running` — read GET /runs/{id} for the precise state.
     * @enum {string}
     */
    RunListStatus: "pending" | "running" | "completed" | "failed" | "cancelled";
    /**
     * @description Pricing model for a workflow listing.
     * @enum {string}
     */
    RunModel: "free" | "per_run";
    /** @description Set when `status` is `completed`, null otherwise. `completed`: every step finished. `completed_with_issues`: the run returned its outputs but some steps failed; it is charged for the completed steps' compute only, without the creator's price. */
    RunOutcome: ("completed" | "completed_with_issues") | null;
    /** @description One output produced by the workflow. */
    RunOutputField: {
      name: string;
      nodeId: string;
      type: string;
      value: unknown;
    } & {
      [key: string]: unknown;
    };
    /** @description Presented runs only: ease from `floor` toward `ceiling` over `etaMs` without reaching it; the next hint moves the band. */
    RunProgressHint: {
      /** @description Progress this band may approach, in percent, until the next hint arrives. */
      ceiling: number;
      /** @description Estimated milliseconds to reach `ceiling`. */
      etaMs: number;
      /** @description Confirmed progress, in percent. */
      floor: number;
    };
    /** @description Edgaze starts runs immediately while it has capacity. At full capacity a run waits in line and starts automatically, in order; nothing is needed from the caller and nothing is charged for waiting. A run that waits past its limit fails with a reason and is not charged. */
    RunQueue: {
      /** @description Estimated seconds until it starts, or null when unknown. */
      etaSeconds: number | null;
      /** @description Place in line, 1 = next. 0 while starting. */
      position: number;
      /**
       * @description `waiting`: in line for capacity. `starting`: it just left the line and is being started.
       * @enum {string}
       */
      state: "waiting" | "starting";
    };
    /** @description The stream failed on the server. The connection then closes; reconnect with the last `id:` you processed. */
    RunStreamError: {
      /** @description Human-readable explanation. Do not parse. */
      error: string;
    };
    /** @description One run event on the SSE stream. The frame's `event:` is `run.status` for run lifecycle events (`status` is set) and the event's `type` otherwise; its `id:` is `sequence`. Same events as GET /runs/{id}/events, with this envelope: `occurredAt` instead of `ts`, `runId` added, `status`/`reason` lifted to the top level, and absent fields omitted rather than null. */
    RunStreamEvent: {
      /** @description 1-based execution attempt on node events. Omitted on run-level events. */
      attempt?: number;
      /** @description Event-specific content. Omitted when the event carries none. */
      data?: components["schemas"]["RunEventData"];
      /** @description Node (or, on presented runs, opaque per-run stage id) the event belongs to. Omitted on run-level events. */
      nodeId?: string;
      /**
       * Format: date-time
       * @description When the event happened. `RunEvent.ts` on GET /runs/{id}/events.
       */
      occurredAt: string;
      /** @description Buyer-safe failure text, on the event that fails the run. */
      reason?: string;
      /** Format: uuid */
      runId: string;
      /** @description Same as the frame's SSE `id:`. Resume with it as `Last-Event-ID`. */
      sequence: number;
      /** @description Run status this event implies. Present exactly on run lifecycle events, which are sent with `event: run.status`. */
      status?: components["schemas"]["PublicRunStatus"];
      /** @description Event name, the same values as `RunEvent.type`. Ignore values you do not recognize. */
      type:
        | (
            | "run.queued"
            | "run.queue_position"
            | "run.preparing"
            | "run.started"
            | "run.suspended"
            | "run.resumed"
            | "run.completed"
            | "run.failed"
            | "run.cancelled"
            | "node.started"
            | "node.output.delta"
            | "node.completed"
            | "node.failed"
            | "node.retry_scheduled"
            | "node.skipped"
          )
        | string;
    };
    /** @description Heartbeat sent every 15 seconds while idle. No SSE `id:`; ignore it. */
    RunStreamPing: {
      /** @description Server time, in Unix milliseconds. */
      t: number;
    };
    /** @description Planned roll-over, about every 5 minutes. The connection then closes; reconnect with `Last-Event-ID: <lastSequence>` and nothing is lost or repeated. Not an error. */
    RunStreamReconnect: {
      /** @description Last sequence sent on this connection; also the frame's SSE `id:`. */
      lastSequence: number;
      /** @description Suggested wait before reconnecting; also sent as SSE `retry:`. */
      retryMs: number;
    };
    /** @description The run's folded state. Sent first on every connection and again as the last frame when the run ends. Carries no SSE `id:`, so it never moves your resume cursor. Read outputs from GET /runs/{id}. */
    RunStreamSnapshot: {
      run: {
        /** Format: uuid */
        id: string;
        /** @description Highest sequence in the run's log when the snapshot was taken. */
        lastEventSequence: number;
        /** @description Buyer-safe failure text when `status` is `failed`, otherwise null. */
        reason: string | null;
        status: components["schemas"]["PublicRunStatus"];
      };
    };
    /** @description Inner error body for an error code this version of the document does not list yet. Handle it like any other error with the same HTTP status. */
    UnknownError: {
      /** @description A code added after this version of the document. */
      code: string;
      /** @description Human-readable failure reason. Do not parse; branch on `code` instead. */
      message: string;
    };
    /**
     * @description How the authenticated key holder can currently pay to run this workflow: `owned` (the caller is the creator), `purchased` (a prior purchase covers it), or `wallet` (it will be billed to wallet balance at run time). `purchase_required` marks legacy unlock listings that cannot be run or bought through the API — `apiRunnableNow` is false and POST /runs returns 403 `forbidden`. Purchasing is a web-only checkout flow; send the buyer to `purchaseUrl` on the workflow detail response.
     * @enum {string}
     */
    UserAccess: "owned" | "purchased" | "wallet" | "purchase_required";
    /** @description Body posted to a webhook endpoint when a run reaches a terminal state. To deduplicate, use the `edgaze-delivery-id` header, or `runId` plus `type` when that header is absent. */
    WebhookRunEventPayload: {
      /**
       * Format: date-time
       * @description When the run reached its terminal state.
       */
      occurredAt: string;
      outcome: components["schemas"]["RunOutcome"];
      /** @description Buyer-safe failure explanation, the same text as `Run.reason`. Non-null only when `status` is `failed`. */
      reason: string | null;
      /**
       * Format: uuid
       * @description The run that reached a terminal state.
       */
      runId: string;
      /**
       * Format: uri
       * @description Absolute URL for GET /runs/{id}. The body carries no outputs or charge: fetch this URL with an API key that has `run:read` to read them.
       */
      runUrl: string;
      /**
       * @description Terminal run status, as GET /runs/{id} reports it.
       * @enum {string}
       */
      status: "completed" | "failed" | "cancelled";
      /**
       * @description Event type. Matches the `edgaze-event` header.
       * @enum {string}
       */
      type: "run.completed" | "run.failed" | "run.cancelled";
    };
    /** @description Body posted when a developer clicks Send test in the developer console. It carries no run. */
    WebhookTestPayload: {
      /** @example This is a test delivery from Edgaze. */
      message: string;
      /** Format: date-time */
      occurredAt: string;
      /** @constant */
      type: "webhook.test";
    };
    /** @description Full workflow detail with input schema and version visibility. */
    WorkflowDetail: {
      accessLabel: string;
      /** @description Current active version published by the workflow owner. */
      activeVersionId: string | null;
      apiAccessAllowed: boolean;
      apiRunnableNow: boolean;
      credentialMode: components["schemas"]["CredentialMode"];
      description: string | null;
      /** @description Estimated run price shown to the buyer. The final price is confirmed when the run starts and may differ slightly from older catalog data. USD amount as a JSON number with up to six decimal places. Preserve the documented precision and do not round intermediate calculations to two decimal places. */
      displayedRunPriceUsd: number | null;
      edgazeCode: string | null;
      exampleRequest: components["schemas"]["WorkflowExampleRunRequest"];
      /** Format: uuid */
      id: string;
      inputCount: number;
      inputSchema: components["schemas"]["WorkflowInputField"][];
      name: string;
      ownerHandle: string | null;
      /** @description Version the caller is pinned to via a prior purchase, or `null` when they follow the active version. */
      pinnedVersionId: string | null;
      /** @description Human-readable note on how this listing is priced. Present whenever `displayedRunPriceUsd` is a positive estimate; explains that settlement uses the live quote at run start. */
      pricingExplanation: string | null;
      /** @description Web checkout page for this workflow, or `null` when it has no public listing. Purchasing is not available through the API; send a buyer here when `userAccess` is `purchase_required`. */
      purchaseUrl: string | null;
      requiredProviders: components["schemas"]["RequiredProvider"][];
      responseShape: components["schemas"]["WorkflowRunResponseShape"];
      runModel: components["schemas"]["RunModel"];
      /** @description True when the caller is pinned to an older version than the active one. Same workflow id can execute different immutable graphs. */
      updateAvailable: boolean;
      userAccess: components["schemas"]["UserAccess"];
      versionId: string | null;
      versionLabel: string | null;
    };
    /** @description Ready-to-copy example POST /runs payload for this workflow. */
    WorkflowExampleRunRequest: {
      body: {
        idempotencyKey?: string;
        inputs: {
          [key: string]: unknown;
        };
        /** Format: uuid */
        workflow: string;
      } & {
        [key: string]: unknown;
      };
      /** @constant */
      method: "POST";
      /** Format: uri */
      url: string;
    };
    /**
     * @description UUID of the workflow.
     * @example 550e8400-e29b-41d4-a716-446655440000
     */
    WorkflowIdParam: string;
    /** @description Single input field from the workflow's published input schema. */
    WorkflowInputField: {
      /** @description Pre-filled value to use when the caller supplies nothing. */
      defaultValue?: string;
      /** @description Helper text explaining the field. */
      description?: string;
      /** @description Display label for the field. */
      name: string;
      /** @description Stable key for this field. Use it as the `inputs` key when calling POST /runs — `name` is a display label and is not guaranteed unique. */
      nodeId: string;
      /** @description Allowed choices. Present only when `type` is `dropdown`. */
      options?: components["schemas"]["WorkflowInputOption"][];
      /** @description Suggested placeholder text. */
      placeholder?: string;
      /** @description When true, POST /runs rejects the run if this key is absent. */
      required?: boolean;
      /** @description Identifier of the node kind that produced this field. Informational. */
      specId?: string;
      type: components["schemas"]["WorkflowInputType"];
    };
    /** @description One selectable choice for a `dropdown` input. */
    WorkflowInputOption: {
      /** @description Human-readable choice shown to a person. */
      label: string;
      /** @description Value to send in `inputs` when this choice is picked. */
      value: string;
    };
    /**
     * @description Control type for an input field. `dropdown` is the only type that populates `options`. `password` fields are per-run credentials: encrypted at rest and deleted when the run ends. `file` and `json` expect a JSON-encoded value.
     * @enum {string}
     */
    WorkflowInputType:
      "text" | "password" | "number" | "textarea" | "url" | "file" | "json" | "dropdown";
    /** @description Compact row in the paginated workflow catalog. Fetch GET /workflows/{id} for the input schema. */
    WorkflowListItem: {
      accessLabel: string;
      apiRunnableNow: boolean;
      credentialMode: components["schemas"]["CredentialMode"];
      description: string | null;
      /** @description Estimated run price shown to the buyer. The final price is confirmed when the run starts and may differ slightly from older catalog data. USD amount as a JSON number with up to six decimal places. Preserve the documented precision and do not round intermediate calculations to two decimal places. */
      displayedRunPriceUsd: number | null;
      edgazeCode: string | null;
      /** Format: uuid */
      id: string;
      name: string;
      ownerHandle: string | null;
      /** @description Human-readable note on how this listing is priced. Present whenever `displayedRunPriceUsd` is a positive estimate; explains that settlement uses the live quote at run start. */
      pricingExplanation: string | null;
      requiredProviders: components["schemas"]["RequiredProvider"][];
      runModel: components["schemas"]["RunModel"];
      runsCount: number | null;
      userAccess: components["schemas"]["UserAccess"];
    };
    /** @description Response body for GET /workflows. */
    WorkflowListResponse: {
      pagination: components["schemas"]["Pagination"];
      workflows: components["schemas"]["WorkflowListItem"][];
    };
    /** @description Documentation-only shape showing what POST /runs returns for this workflow. */
    WorkflowRunResponseShape: {
      run: {
        /** Format: uri */
        eventsUrl: string;
        /** Format: uuid */
        id: string;
        status: string;
        /** Format: uri */
        statusUrl: string;
        /** Format: uri */
        streamUrl: string;
      };
    };
    /** @description Response body for GET /workflows/{id}/versions. Owners see the full history; buyers see the versions their pin or entitlement covers. */
    WorkflowVersionsResponse: {
      activeVersionId: string | null;
      isOwner: boolean;
      pinnedVersionId: string | null;
      updateAvailable: boolean;
      versions: components["schemas"]["WorkflowVersionSummary"][];
    };
    /** @description Compact metadata for one immutable workflow version. */
    WorkflowVersionSummary: {
      /** Format: date-time */
      createdAt: string;
      /** Format: uuid */
      id: string;
      isActive: boolean;
      isPurchased: boolean;
      releaseNotes: string | null;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
  listRuns: {
    parameters: {
      query?: {
        /** @description `pagination.nextCursor` from the previous page. Opaque. Cannot be combined with `offset`. */
        cursor?: string;
        /** @description Page size from 1 to 50. Defaults to 24. */
        limit?: string;
        /** @description Pagination offset. Defaults to 0. Prefer `cursor`. */
        offset?: string;
        /** @description Return only runs currently in this status. */
        status?: string;
        /** @description Return only runs of this workflow id. */
        workflow?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Paginated run history. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RunListResponse"];
        };
      };
      /** @description Invalid query parameters (`invalid_request`, including `cursor` combined with `offset`), or a `cursor` this endpoint did not issue (`invalid_cursor`). */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  createRun: {
    parameters: {
      query?: never;
      header?: {
        /** @description Currently optional for backward compatibility, but strongly recommended for every request (max 255 chars). Prefer the header over `body.idempotencyKey`; when both are set they must match, or the request is rejected with 400 `invalid_request`. Values are case-sensitive and scoped to the Edgaze account. The fingerprint covers workflow, normalized inputs, and requested version. An exact replay returns the original run; a different request returns 409 `idempotency_conflict`. Keys have no time-based expiry while the run record exists. */
        "Idempotency-Key"?: string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateRunRequest"];
      };
    };
    responses: {
      /** @description Run accepted. */
      202: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Present only when the request used the deprecated `workflowId` field. RFC 9745 date the field was deprecated, `@1786492800` (2026-08-12). Send `workflow` instead. */
          Deprecation?: string;
          /** @description Present only with `Deprecation`: `<https://www.edgaze.ai/docs/api/versioning>; rel="deprecation"`. */
          Link?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Present only with `Deprecation`: `299 - "workflowId is deprecated; use workflow"`. */
          Warning?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CreateRunResponse"];
        };
      };
      /** @description Request rejected before the run started. `invalid_json`: the body was not parseable JSON. `missing_workflow`: no `workflow` id was supplied. `invalid_inputs`: one or more inputs were rejected — `error.details` lists the offending `input` keys. `invalid_request`: the `Idempotency-Key` header conflicted with `body.idempotencyKey`. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description This API key has reached its spend cap. */
      402: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Not entitled to run this workflow (`forbidden`), the account is restricted (`account_restricted`), or the creator's paid listings are paused (`creator_listings_paused`). `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Workflow not found. */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Idempotency key reused with a different request (`idempotency_conflict`), or the workflow needs third-party accounts the caller has not connected (`integration_connection_required`; `error.details` lists them, each with a `connectUrl`). */
      409: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Rate limited. A key that sends up to 60 POST /runs requests per minute is never rate limited. Above that, requests may be rejected with 429 `rate_limited`; how many more get through is not fixed, so do not plan around it. Wait `Retry-After` seconds, then retry with the same `Idempotency-Key`. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Seconds to wait before retrying. */
          "Retry-After"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description The per-minute rate that is guaranteed not to be limited (60). Sent only on a 429 response. */
          "X-RateLimit-Limit"?: string;
          /** @description Always `0`. Sent only on a 429 response. */
          "X-RateLimit-Remaining"?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  getRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description UUID returned from POST /runs. */
        id: components["schemas"]["RunIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Run detail. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Run"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Run not found (also returned for cross-tenant reads). */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description The run's outputs are too large to return in one response. */
      413: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  cancelRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description UUID returned from POST /runs. */
        id: components["schemas"]["RunIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Cancellation recorded. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CancelRunResponse"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Run not found (also returned for cross-tenant calls). */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Cancellation could not be delivered. Safe to retry. */
      503: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  listRunEvents: {
    parameters: {
      query?: {
        /** @description Return events strictly after this sequence. Defaults to 0. */
        afterSequence?: number;
        /** @description Page size from 1 to 500. Defaults to 100. */
        limit?: number;
      };
      header?: never;
      path: {
        /** @description UUID returned from POST /runs. */
        id: components["schemas"]["RunIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Ordered page of events. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RunEventsPage"];
        };
      };
      /** @description Invalid pagination cursor. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Run not found. */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  streamRun: {
    parameters: {
      query?: {
        /** @description Alternative resume cursor when the client cannot set the header. */
        afterSequence?: number;
      };
      header?: {
        /** @description SSE resume cursor. When present, must be a non-negative integer; the server replays events with a strictly greater sequence. */
        "Last-Event-ID"?: string;
      };
      path: {
        /** @description UUID returned from POST /runs. */
        id: components["schemas"]["RunIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description SSE stream of run events. */
      200: {
        headers: {
          /** @description `private, no-store, no-transform` so intermediaries never buffer the stream. */
          "Cache-Control"?: string;
          /** @description Includes `Authorization`. */
          Vary?: string;
          /** @description `no` — signals proxies to disable buffering. */
          "X-Accel-Buffering"?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "text/event-stream": string;
        };
      };
      /** @description Invalid `Last-Event-ID` cursor. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Run not found. */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error before the stream opened. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  listWorkflows: {
    parameters: {
      query?: {
        limit?: string;
        offset?: string;
        q?: string;
        runModel?: string;
        runnableOnly?: string;
        scope?: string;
        sort?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Paginated workflow catalog. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["WorkflowListResponse"];
        };
      };
      /** @description Invalid query parameters. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description API key is missing the required scope. `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  getWorkflow: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description UUID of the workflow. */
        id: components["schemas"]["WorkflowIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Workflow detail. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["WorkflowDetail"];
        };
      };
      /** @description Missing or malformed workflow id. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Not entitled to this workflow. `forbidden`: the caller has no access to this workflow, version, or purchase (non-leaky). `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Workflow not found. */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  acceptWorkflowUpdate: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description UUID of the workflow. */
        id: components["schemas"]["WorkflowIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Purchase pin updated. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["AcceptWorkflowUpdateResponse"];
        };
      };
      /** @description Missing or malformed workflow id. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Rejected for one of two reasons that need different client handling. `insufficient_scope`: the key lacks `workflow:write` — mint a key with that scope. `forbidden`: the key is valid and scoped, but the caller has no purchase to re-pin (including owner keys, which have no purchase) — there is nothing to retry. Branch on `error.code`. `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Workflow has no active version to accept. */
      409: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
  listWorkflowVersions: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description UUID of the workflow. */
        id: components["schemas"]["WorkflowIdParam"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Entitled workflow versions. */
      200: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["WorkflowVersionsResponse"];
        };
      };
      /** @description Missing or malformed workflow id. */
      400: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Invalid or missing API key. */
      401: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Not entitled to this workflow. `forbidden`: the caller has no access to this workflow, version, or purchase (non-leaky). `insufficient_scope`: the API key lacks every scope this operation accepts (`x-required-scopes`). `account_restricted`: the account that owns the API key is restricted. Not retryable. */
      403: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Workflow not found. */
      404: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description `rate_limited`: too many requests. Wait `Retry-After` seconds, then retry. Only POST /runs is limited today; every operation lists this so clients already handle it if that changes. */
      429: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
      /** @description Unexpected server error. */
      500: {
        headers: {
          /** @description Always `private, no-store` on authenticated endpoints to prevent shared caching. */
          "Cache-Control"?: string;
          /** @description Always includes `Authorization` on authenticated endpoints. */
          Vary?: string;
          /** @description Identifies this request in Edgaze's logs. Present on every response, success or error. Quote it when you report a problem. Opaque: do not parse it. */
          "X-Request-Id"?: string;
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ErrorEnvelope"];
        };
      };
    };
  };
}
