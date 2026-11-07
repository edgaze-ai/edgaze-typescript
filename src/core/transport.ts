import { APIPromise, type WithResponse } from "./api-promise.js";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  EdgazeError,
  parseRetryAfter,
} from "./errors.js";
import { isAbortError, sleep } from "./utils.js";
import { VERSION } from "../version.js";

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Options you can pass as the last argument of any SDK method. */
export interface RequestOptions {
  /** Abort the request (and any retries) with this signal. */
  signal?: AbortSignal | undefined;
  /** Per-attempt timeout in milliseconds. Overrides the client's `timeout`. */
  timeout?: number | undefined;
  /** Retries after the first attempt. Overrides the client's `maxRetries`. */
  maxRetries?: number | undefined;
  /** Extra headers. A `null` value removes a header the SDK would otherwise send. */
  headers?: Record<string, string | null | undefined> | undefined;
}

export interface TransportConfig {
  apiKey: string;
  baseURL: string;
  timeout: number;
  maxRetries: number;
  fetch: Fetch;
  defaultHeaders: Record<string, string | null | undefined>;
  /** Longest `Retry-After` the SDK will wait out automatically before surfacing the error. */
  maxRetryAfterMs: number;
  isBrowser: boolean;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestSpec {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, QueryValue> | undefined;
  body?: unknown;
  headers?: Record<string, string | null | undefined> | undefined;
  /** Accept header for the request. Defaults to JSON. */
  accept?: string | undefined;
  /**
   * Whether a failed attempt may be repeated. GET is always safe. POST is safe only when the
   * endpoint is idempotent or the request carries an Idempotency-Key.
   */
  retryable: boolean;
  /** Return the response without reading the body (streaming). */
  raw?: boolean | undefined;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;

export class Transport {
  constructor(readonly config: TransportConfig) {}

  /** Sends a request and parses the JSON body. */
  request<T>(spec: RequestSpec, options: RequestOptions = {}): APIPromise<T> {
    return new APIPromise<T>(this.send(spec, options) as Promise<WithResponse<T>>);
  }

  /** Sends a request with retries and returns the successful response with its body unread. */
  async open(spec: RequestSpec, options: RequestOptions = {}): Promise<Response> {
    const { response } = await this.send({ ...spec, raw: true }, options);
    return response;
  }

  buildURL(path: string, query?: Record<string, QueryValue>): string {
    const base = this.config.baseURL.replace(/\/+$/, "");
    const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private buildHeaders(spec: RequestSpec, options: RequestOptions, retryCount: number): Headers {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    headers.set("Accept", spec.accept ?? "application/json");
    if (spec.body !== undefined) headers.set("Content-Type", "application/json");
    // Browsers forbid setting User-Agent; everywhere else it identifies the SDK in Edgaze's logs.
    if (!this.config.isBrowser) headers.set("User-Agent", `edgaze-typescript/${VERSION}`);
    if (retryCount > 0) headers.set("X-Edgaze-Retry-Count", String(retryCount));
    for (const layer of [this.config.defaultHeaders, spec.headers, options.headers]) {
      for (const [key, value] of Object.entries(layer ?? {})) {
        if (value === null) headers.delete(key);
        else if (value !== undefined) headers.set(key, value);
      }
    }
    return headers;
  }

  private async send(spec: RequestSpec, options: RequestOptions): Promise<WithResponse<unknown>> {
    const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? this.config.maxRetries));
    const timeout = options.timeout ?? this.config.timeout;
    const url = this.buildURL(spec.path, spec.query);
    const body = spec.body === undefined ? undefined : JSON.stringify(spec.body);

    for (let attempt = 0; ; attempt++) {
      if (options.signal?.aborted) throw new APIUserAbortError();
      const retriesLeft = spec.retryable ? maxRetries - attempt : 0;

      let response: Response;
      const attemptController = new AbortController();
      const timer = setTimeout(() => attemptController.abort(new TimeoutMarker()), timeout);
      const onUserAbort = () => attemptController.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", onUserAbort, { once: true });
      try {
        response = await this.config.fetch(url, {
          method: spec.method,
          headers: this.buildHeaders(spec, options, attempt),
          ...(body === undefined ? {} : { body }),
          signal: attemptController.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onUserAbort);
        if (options.signal?.aborted) throw new APIUserAbortError();
        const timedOut =
          attemptController.signal.reason instanceof TimeoutMarker ||
          (isAbortError(err) && attemptController.signal.aborted);
        if (retriesLeft > 0) {
          await sleep(backoff(attempt), options.signal);
          continue;
        }
        if (timedOut) throw new APIConnectionTimeoutError(`Request timed out after ${timeout} ms.`);
        throw new APIConnectionError(connectionMessage(err), { cause: err });
      }

      if (spec.raw && response.ok) {
        // The caller reads the body itself; the timeout covered only the time to headers. The
        // user's signal stays linked so aborting it also closes the body.
        clearTimeout(timer);
        return { data: undefined, response, requestId: response.headers.get("x-request-id") };
      }

      let parsed: unknown;
      try {
        parsed = await readBody(response);
      } catch (err) {
        if (options.signal?.aborted) throw new APIUserAbortError();
        const timedOut = attemptController.signal.reason instanceof TimeoutMarker;
        if (retriesLeft > 0) {
          await sleep(backoff(attempt), options.signal);
          continue;
        }
        if (timedOut) throw new APIConnectionTimeoutError(`Request timed out after ${timeout} ms.`);
        throw new APIConnectionError(
          `Failed to read the response body: ${connectionMessage(err)}`,
          {
            cause: err,
          },
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onUserAbort);
      }

      if (response.ok) {
        return { data: parsed, response, requestId: response.headers.get("x-request-id") };
      }

      if (retriesLeft > 0 && RETRYABLE_STATUS.has(response.status)) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (retryAfter === null || retryAfter <= this.config.maxRetryAfterMs) {
          await sleep(retryAfter ?? backoff(attempt), options.signal);
          continue;
        }
      }
      throw APIError.from(response.status, response.headers, parsed);
    }
  }
}

class TimeoutMarker extends EdgazeError {
  override name = "TimeoutError";
}

/** Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s, capped at 8s. */
export function backoff(attempt: number): number {
  const base = Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.round(base * (1 - Math.random() * 0.25));
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json") || /^\s*[{[]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      if (response.ok) throw new Error("The response was not valid JSON.");
      return text;
    }
  }
  return text;
}

function connectionMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    const detail = cause instanceof Error ? `: ${cause.message}` : "";
    return `${err.message}${detail}`;
  }
  return String(err);
}
