import type { APIPromise } from "../core/api-promise.js";
import { RunWaitTimeoutError } from "../core/errors.js";
import { PagePromise, type Page } from "../core/pagination.js";
import { RunStream, TERMINAL_STATUSES, type RunStreamOptions } from "../core/run-stream.js";
import type { RequestOptions } from "../core/transport.js";
import { pathSegment, randomId, sleep } from "../core/utils.js";
import type {
  CancelRunResponse,
  CreateRunResponse,
  Run,
  RunEvent,
  RunEventsPage,
  RunListItem,
  RunListResponse,
  RunListStatus,
} from "../types.js";
import { APIResource } from "./resource.js";

export interface RunCreateParams {
  /** Id of the workflow to run. */
  workflow: string;
  /**
   * Input values keyed by the input's `nodeId` (preferred) or `name`, from the workflow's
   * `inputSchema`. Omit for a workflow without inputs.
   */
  inputs?: Record<string, unknown>;
  /** Run this exact workflow version instead of your pinned (or the active) version. */
  version?: string;
}

export interface RunCreateOptions extends RequestOptions {
  /**
   * Makes the request safe to repeat: the same key with the same request returns the original run
   * instead of starting another. The SDK generates one per call when you omit it, so its own
   * retries can never start a run twice. Pass your own (max 255 characters) to make retries across
   * process restarts safe too, for example a job id.
   */
  idempotencyKey?: string | undefined;
}

export interface RunListParams {
  /** Only runs currently in this status. */
  status?: RunListStatus;
  /** Only runs of this workflow id. */
  workflow?: string;
  /** Page size, 1 to 50. */
  limit?: number;
  /** `pagination.nextCursor` from a previous page. Iterating fetches following pages for you. */
  cursor?: string;
  /** Rows to skip. Prefer `cursor`; offsets can repeat or skip runs created while you page. */
  offset?: number;
}

export interface RunEventListParams {
  /** Only events after this sequence. */
  afterSequence?: number;
  /** Page size, 1 to 500. */
  limit?: number;
}

export interface RunWaitOptions {
  /** Give up after this many milliseconds and throw RunWaitTimeoutError. Defaults to 15 minutes. */
  timeout?: number | undefined;
  /** First wait between polls, in milliseconds (minimum 1000). Defaults to 1000. */
  pollInterval?: number | undefined;
  /** Longest wait between polls; the interval grows towards it. Defaults to 5000. */
  maxPollInterval?: number | undefined;
  /** Abort waiting. The run itself keeps going; cancel it with `runs.cancel`. */
  signal?: AbortSignal | undefined;
  /** Called with every non-terminal state the SDK sees while waiting. */
  onPoll?: ((run: Run) => void) | undefined;
  /** Request options for each poll. */
  requestOptions?: Omit<RequestOptions, "signal"> | undefined;
}

export type RunPage = Page<RunListParams, RunListResponse, RunListItem>;
export type RunEventPage = Page<RunEventListParams, RunEventsPage, RunEvent>;

const DEFAULT_WAIT_TIMEOUT_MS = 15 * 60_000;
/** The API asks clients not to poll a run more than once per second. */
const MIN_POLL_INTERVAL_MS = 1000;

export class Runs extends APIResource {
  /**
   * Starts a run. The run executes asynchronously: the response confirms it was accepted.
   * Follow it with `runs.stream`, wait for it with `runs.wait`, or use `runs.createAndWait`.
   *
   * ```ts
   * const { run } = await client.runs.create({ workflow: workflowId, inputs: { topic: "tides" } });
   * ```
   */
  create(params: RunCreateParams, options: RunCreateOptions = {}): APIPromise<CreateRunResponse> {
    const { idempotencyKey, ...requestOptions } = options;
    const key = idempotencyKey ?? randomId();
    if (key.length === 0 || key.length > 255) {
      throw new TypeError("idempotencyKey must be 1 to 255 characters.");
    }
    if (typeof params?.workflow !== "string" || params.workflow.trim() === "") {
      throw new TypeError("workflow must be a workflow id.");
    }
    const body: Record<string, unknown> = { workflow: params.workflow };
    if (params.inputs !== undefined) body.inputs = params.inputs;
    if (params.version !== undefined) body.version = params.version;
    return this.transport.request<CreateRunResponse>(
      {
        method: "POST",
        path: "/runs",
        body,
        headers: { "Idempotency-Key": key },
        // Safe because of the Idempotency-Key: a repeat returns the original run.
        retryable: true,
      },
      requestOptions,
    );
  }

  /** Retrieves a run: its status, failure reason, charge and outputs. */
  retrieve(id: string, options: RequestOptions = {}): APIPromise<Run> {
    return this.transport.request<Run>(
      { method: "GET", path: `/runs/${pathSegment(id, "id")}`, retryable: true },
      options,
    );
  }

  /**
   * Lists your runs, newest first. Iterate to walk every page with a stable cursor.
   *
   * ```ts
   * for await (const run of client.runs.list({ status: "failed" })) console.log(run.id);
   * ```
   */
  list(
    params: RunListParams = {},
    options: RequestOptions = {},
  ): PagePromise<RunListParams, RunListResponse, RunListItem> {
    return new PagePromise(
      params,
      (p, o) =>
        this.transport.request<RunListResponse>(
          {
            method: "GET",
            path: "/runs",
            query: {
              status: p.status,
              workflow: p.workflow,
              limit: p.limit,
              cursor: p.cursor,
              offset: p.offset,
            },
            retryable: true,
          },
          o,
        ),
      {
        items: (raw) => raw.runs,
        nextParams: (raw, p) => {
          const cursor = raw.pagination.nextCursor;
          if (!raw.pagination.hasMore || !cursor) return null;
          // A cursor cannot be combined with an offset; the cursor already encodes the position.
          const { offset: _offset, ...rest } = p;
          return { ...rest, cursor };
        },
      },
      options,
    );
  }

  /**
   * Requests cancellation. A run that has not started is cancelled before this returns; a running
   * one stops shortly after (`cancelRequested: true`). A finished run is returned unchanged.
   * Cancelled runs are never charged.
   */
  cancel(id: string, options: RequestOptions = {}): APIPromise<CancelRunResponse> {
    return this.transport.request<CancelRunResponse>(
      // Idempotent on the server, so retrying is safe.
      { method: "POST", path: `/runs/${pathSegment(id, "id")}/cancel`, retryable: true },
      options,
    );
  }

  /**
   * Lists a run's durable event log in sequence order. Iterate to walk every event.
   * For live progress, prefer `runs.stream`.
   */
  events(
    id: string,
    params: RunEventListParams = {},
    options: RequestOptions = {},
  ): PagePromise<RunEventListParams, RunEventsPage, RunEvent> {
    const path = `/runs/${pathSegment(id, "id")}/events`;
    return new PagePromise(
      params,
      (p, o) =>
        this.transport.request<RunEventsPage>(
          {
            method: "GET",
            path,
            query: { afterSequence: p.afterSequence, limit: p.limit },
            retryable: true,
          },
          o,
        ),
      {
        items: (raw) => raw.events,
        nextParams: (raw, p) =>
          raw.hasMore && raw.nextAfterSequence !== null
            ? { ...p, afterSequence: raw.nextAfterSequence }
            : null,
      },
      options,
    );
  }

  /**
   * Streams the run's events live over Server-Sent Events: a replay of what already happened,
   * then new events as they occur. Reconnects on its own without losing or repeating events, and
   * ends once the run is finished.
   *
   * ```ts
   * for await (const message of client.runs.stream(run.id)) {
   *   if (message.kind === "event" && message.event.type === "node.output.delta") {
   *     process.stdout.write(message.event.data?.text ?? "");
   *   }
   * }
   * ```
   */
  stream(id: string, options: RunStreamOptions = {}): RunStream {
    return new RunStream(this.transport, id, options);
  }

  /**
   * Polls the run until it is `completed`, `failed` or `cancelled` and returns it. A failed run is
   * returned, not thrown: check `run.status`. Throws RunWaitTimeoutError when `timeout` passes
   * first. A suspended run waiting for credentials does not finish on its own; the timeout covers
   * that case.
   */
  async wait(id: string, options: RunWaitOptions = {}): Promise<Run> {
    pathSegment(id, "id");
    const timeout = options.timeout ?? DEFAULT_WAIT_TIMEOUT_MS;
    const maxInterval = Math.max(options.maxPollInterval ?? 5000, MIN_POLL_INTERVAL_MS);
    let interval = Math.min(
      Math.max(options.pollInterval ?? MIN_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS),
      maxInterval,
    );
    const deadline = Date.now() + timeout;

    while (true) {
      const run = await this.retrieve(id, {
        ...options.requestOptions,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (TERMINAL_STATUSES.has(run.status)) return run;
      options.onPoll?.(run);
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new RunWaitTimeoutError(id, timeout);
      await sleep(Math.min(interval, remaining), options.signal);
      interval = Math.min(Math.round(interval * 1.5), maxInterval);
    }
  }

  /**
   * Starts a run and waits for it to finish. Returns the finished run with its outputs.
   *
   * ```ts
   * const run = await client.runs.createAndWait({ workflow: workflowId, inputs: { topic: "tides" } });
   * if (run.status === "completed") console.log(run.outputs);
   * ```
   */
  async createAndWait(
    params: RunCreateParams,
    options: RunCreateOptions & { wait?: Omit<RunWaitOptions, "signal"> } = {},
  ): Promise<Run> {
    const { wait, ...createOptions } = options;
    const { run } = await this.create(params, createOptions);
    return this.wait(run.id, {
      ...wait,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }
}
