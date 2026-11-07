import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  EdgazeError,
  isRecord,
} from "./errors.js";
import { readSSE } from "./sse.js";
import { backoff, type RequestOptions, type Transport } from "./transport.js";
import { pathSegment, sleep } from "./utils.js";
import type { RunStatus, RunStreamEvent, RunStreamSnapshot } from "../types.js";

/** What iterating a `RunStream` yields. */
export type RunStreamMessage =
  | {
      kind: "snapshot";
      /** The run's folded state: first on every connection, and last when the run ends. */
      snapshot: RunStreamSnapshot;
    }
  | {
      kind: "event";
      /** The SSE `event:` name: `run.status` for lifecycle events, otherwise the event's type. */
      name: string;
      event: RunStreamEvent;
    };

export interface RunStreamOptions extends RequestOptions {
  /** Start after this sequence instead of replaying the whole log. */
  afterSequence?: number | undefined;
  /**
   * Reconnect automatically after the server's planned roll-over (about every 5 minutes), a
   * server-side stream error, or a dropped connection, resuming from the last event received so
   * nothing is lost or repeated. Defaults to true.
   */
  reconnect?: boolean | undefined;
  /** Reconnect attempts in a row, without receiving anything, before giving up. Defaults to 10. */
  maxReconnectAttempts?: number | undefined;
  /**
   * Treat the connection as dead when nothing arrives for this long, in milliseconds. The server
   * sends a ping every 15 seconds while idle. Defaults to 45 000.
   */
  idleTimeout?: number | undefined;
}

export const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** A connection that stayed up this long counts as healthy and resets the reconnect budget. */
const HEALTHY_CONNECTION_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RECONNECTS = 10;

class IdleTimeout extends EdgazeError {
  override name = "IdleTimeout";
}

/**
 * A live run's events over Server-Sent Events. Iterate it with `for await`. It reconnects on its
 * own and ends after the run reaches a terminal status and every event has been delivered.
 *
 * ```ts
 * const stream = client.runs.stream(runId);
 * for await (const message of stream) {
 *   if (message.kind === "event" && message.event.type === "node.output.delta") {
 *     process.stdout.write(message.event.data?.text ?? "");
 *   }
 * }
 * console.log(stream.snapshot?.run.status);
 * ```
 */
export class RunStream implements AsyncIterable<RunStreamMessage> {
  /** Sequence of the last event delivered. Pass it as `afterSequence` to resume elsewhere. */
  lastSequence: number | null = null;
  /** The most recent snapshot received. */
  snapshot: RunStreamSnapshot | null = null;

  private readonly controller = new AbortController();
  private started = false;
  private terminalSeen = false;
  private done = false;

  constructor(
    private readonly transport: Transport,
    readonly runId: string,
    private readonly options: RunStreamOptions = {},
  ) {
    pathSegment(runId, "runId");
    if (options.afterSequence !== undefined) {
      if (!Number.isSafeInteger(options.afterSequence) || options.afterSequence < 0) {
        throw new TypeError("afterSequence must be a non-negative integer.");
      }
      this.lastSequence = options.afterSequence;
    }
    const userSignal = options.signal;
    if (userSignal) {
      if (userSignal.aborted) this.controller.abort(userSignal.reason);
      else
        userSignal.addEventListener("abort", () => this.controller.abort(userSignal.reason), {
          once: true,
        });
    }
  }

  /** Stops the stream and closes the connection. A pending iteration throws APIUserAbortError. */
  abort(): void {
    this.controller.abort();
  }

  /**
   * True once the stream ended because the run reached a terminal status and the server closed the
   * connection after delivering everything. (The public stream omits internal events, so sequence
   * numbers can have gaps; completeness is the server's clean close, not a sequence count.)
   */
  get finished(): boolean {
    return this.done;
  }

  /** Reads the stream to the end and returns the final snapshot. */
  async finalSnapshot(): Promise<RunStreamSnapshot | null> {
    for await (const _ of this) {
      // Drain.
    }
    return this.snapshot;
  }

  [Symbol.asyncIterator](): AsyncIterator<RunStreamMessage> {
    if (this.started) throw new Error("A RunStream can only be iterated once.");
    this.started = true;
    return this.iterate();
  }

  private async *iterate(): AsyncGenerator<RunStreamMessage> {
    const reconnect = this.options.reconnect ?? true;
    const maxReconnects = this.options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECTS;
    const idleTimeout = this.options.idleTimeout ?? DEFAULT_IDLE_TIMEOUT_MS;
    let failures = 0;

    try {
      while (true) {
        const connection = new AbortController();
        const linkAbort = () => connection.abort(this.controller.signal.reason);
        if (this.controller.signal.aborted) throw new APIUserAbortError();
        this.controller.signal.addEventListener("abort", linkAbort, { once: true });

        let planned = false;
        let cleanClose = false;
        let sawError = false;
        let retryMs: number | undefined;
        let connectedAt = 0;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        const armIdle = () => {
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => connection.abort(new IdleTimeout()), idleTimeout);
        };

        try {
          const response = await this.transport.open(
            {
              method: "GET",
              path: `/runs/${pathSegment(this.runId, "runId")}/stream`,
              accept: "text/event-stream",
              headers:
                this.lastSequence === null ? {} : { "Last-Event-ID": String(this.lastSequence) },
              retryable: true,
            },
            { ...this.options, signal: connection.signal },
          );
          const type = response.headers.get("content-type") ?? "";
          if (!type.includes("text/event-stream") || !response.body) {
            await response.body?.cancel().catch(() => {});
            throw new APIConnectionError(
              `Expected an event stream but got ${type || "no content type"}.`,
            );
          }
          connectedAt = Date.now();
          armIdle();

          for await (const message of readSSE(response.body)) {
            armIdle();
            if (message.event === "ping") continue;
            if (message.event === "snapshot") {
              const data = parseJSON(message.data);
              if (!isRecord(data) || !isRecord(data.run)) continue;
              this.snapshot = data as unknown as RunStreamSnapshot;
              if (TERMINAL_STATUSES.has(this.snapshot.run.status)) this.terminalSeen = true;
              // The idle timer measures the server, so it pauses while the consumer handles a message.
              clearTimeout(idleTimer);
              yield { kind: "snapshot", snapshot: this.snapshot };
              armIdle();
              continue;
            }
            if (message.event === "reconnect") {
              const data = parseJSON(message.data);
              const last = isRecord(data) ? data.lastSequence : undefined;
              const id = message.id !== undefined ? Number(message.id) : Number.NaN;
              const seq = typeof last === "number" ? last : id;
              if (Number.isSafeInteger(seq) && seq >= (this.lastSequence ?? -1)) {
                this.lastSequence = seq;
              }
              retryMs =
                isRecord(data) && typeof data.retryMs === "number" ? data.retryMs : message.retry;
              planned = true;
              break;
            }
            if (message.event === "error") {
              sawError = true;
              break;
            }
            // Frames without an id never move the cursor; ignore unknown ones.
            if (message.id === undefined) continue;
            const data = parseJSON(message.data);
            if (!isRecord(data)) throw new MalformedFrame();
            const seq =
              typeof data.sequence === "number" ? data.sequence : Number.parseInt(message.id, 10);
            if (!Number.isSafeInteger(seq)) throw new MalformedFrame();
            if (this.lastSequence !== null && seq <= this.lastSequence) continue; // Duplicate.
            this.lastSequence = seq;
            failures = 0;
            const event = data as unknown as RunStreamEvent;
            if (event.status !== undefined && TERMINAL_STATUSES.has(event.status)) {
              this.terminalSeen = true;
            }
            clearTimeout(idleTimer);
            yield { kind: "event", name: message.event, event };
            armIdle();
          }
          cleanClose = !planned && !sawError;
        } catch (err) {
          if (this.controller.signal.aborted) throw new APIUserAbortError();
          // HTTP errors that retrying cannot fix (401, 403, 404, 400) end the stream.
          if (err instanceof APIError) throw err;
          if (!(err instanceof MalformedFrame) && !isConnectionFailure(err, connection.signal)) {
            throw err;
          }
          // Otherwise: dropped connection, idle timeout or a bad frame. Reconnect below.
        } finally {
          clearTimeout(idleTimer);
          this.controller.signal.removeEventListener("abort", linkAbort);
          connection.abort(); // Releases the socket if the server has not closed it.
        }

        if (cleanClose && this.terminalSeen) {
          this.done = true;
          return;
        }
        if (!reconnect) return;
        if (planned) {
          failures = 0;
          await sleep(Math.min(Math.max(retryMs ?? 1000, 0), 30_000), this.controller.signal);
          continue;
        }
        if (connectedAt && Date.now() - connectedAt >= HEALTHY_CONNECTION_MS) failures = 0;
        failures++;
        if (failures > maxReconnects) {
          throw new APIConnectionError(
            `The run stream for ${this.runId} could not be resumed after ${maxReconnects} attempts.`,
          );
        }
        await sleep(backoff(failures - 1), this.controller.signal);
      }
    } finally {
      this.controller.abort();
    }
  }
}

class MalformedFrame extends EdgazeError {
  override name = "MalformedFrame";
  constructor() {
    super("The server sent an event frame that is not valid JSON.");
  }
}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isConnectionFailure(err: unknown, signal: AbortSignal): boolean {
  if (err instanceof APIConnectionError) return true;
  if (signal.reason instanceof IdleTimeout) return true;
  // A body that breaks mid-read surfaces as a TypeError (undici) or an AbortError.
  return err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
}
