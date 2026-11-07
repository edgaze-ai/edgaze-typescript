import type { ErrorCode, ErrorDetail, IntegrationConnectionDetail } from "../types.js";

/** Base class for every error this SDK throws. `instanceof EdgazeError` catches all of them. */
export class EdgazeError extends Error {
  override name = "EdgazeError";
}

/**
 * The API answered with a non-2xx status. Branch on `code` (stable, machine-readable) rather than
 * `message` (human-readable, may change). Codes are an open set: a code this SDK version does not
 * know about still arrives here as a string.
 */
export class APIError extends EdgazeError {
  override name = "APIError";
  /** HTTP status code. */
  readonly status: number;
  /** Machine-readable error code from the response body, e.g. `not_found`. */
  readonly code: ErrorCode | (string & {});
  /**
   * Per-field problems on `invalid_inputs`, or the missing connections on
   * `integration_connection_required`. Undefined for every other code.
   */
  readonly details: ErrorDetail[] | IntegrationConnectionDetail[] | undefined;
  /** The `X-Request-Id` response header. Quote it when you contact Edgaze support. */
  readonly requestId: string | null;
  /** Response headers. */
  readonly headers: Headers;
  /** The parsed response body, or the raw text when it was not JSON. */
  readonly body: unknown;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ErrorDetail[] | IntegrationConnectionDetail[] | undefined;
    headers: Headers;
    body: unknown;
  }) {
    const requestId = init.headers.get("x-request-id");
    super(
      `${init.status} ${init.code}: ${init.message}` +
        (requestId ? ` (request id ${requestId})` : ""),
    );
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.headers = init.headers;
    this.body = init.body;
    this.requestId = requestId;
  }

  /** Builds the right subclass for a status code. */
  static from(status: number, headers: Headers, body: unknown): APIError {
    const parsed = parseErrorBody(body);
    const init = {
      status,
      headers,
      body,
      code: parsed?.code ?? fallbackCode(status),
      message: parsed?.message ?? fallbackMessage(status, body),
      details: parsed?.details,
    };
    switch (status) {
      case 400:
        return new BadRequestError(init);
      case 401:
        return new AuthenticationError(init);
      case 402:
        return new PaymentRequiredError(init);
      case 403:
        return new PermissionDeniedError(init);
      case 404:
        return new NotFoundError(init);
      case 409:
        return new ConflictError(init);
      case 413:
        return new PayloadTooLargeError(init);
      case 422:
        return new UnprocessableEntityError(init);
      case 429:
        return new RateLimitError(init);
      default:
        return status >= 500 ? new InternalServerError(init) : new APIError(init);
    }
  }
}

/** 400: the request was malformed (`invalid_request`, `invalid_inputs`, `invalid_cursor`, ...). */
export class BadRequestError extends APIError {
  override name = "BadRequestError";
}
/** 401: the API key is missing, malformed or revoked (`unauthorized`). */
export class AuthenticationError extends APIError {
  override name = "AuthenticationError";
}
/** 402: the key's spend cap is reached (`spend_cap_reached`). */
export class PaymentRequiredError extends APIError {
  override name = "PaymentRequiredError";
}
/** 403: the key lacks a scope or access (`insufficient_scope`, `forbidden`, `account_restricted`, ...). */
export class PermissionDeniedError extends APIError {
  override name = "PermissionDeniedError";
}
/** 404: the workflow or run does not exist, or is not visible to this key (`not_found`). */
export class NotFoundError extends APIError {
  override name = "NotFoundError";
}
/** 409: `idempotency_conflict`, `integration_connection_required`, or a state conflict. */
export class ConflictError extends APIError {
  override name = "ConflictError";
}
/** 413: the run's outputs are too large to return (`output_too_large`). */
export class PayloadTooLargeError extends APIError {
  override name = "PayloadTooLargeError";
}
/** 422: reserved for validation failures; not returned by v1 today. */
export class UnprocessableEntityError extends APIError {
  override name = "UnprocessableEntityError";
}
/** 429: too many requests (`rate_limited`). The SDK already retried; see `retryAfterMs`. */
export class RateLimitError extends APIError {
  override name = "RateLimitError";
  /** How long the server asked you to wait, from `Retry-After`, or null when it did not say. */
  get retryAfterMs(): number | null {
    return parseRetryAfter(this.headers.get("retry-after"));
  }
}
/** 5xx: Edgaze failed (`internal_error`, `cancel_unavailable`, ...). The SDK already retried. */
export class InternalServerError extends APIError {
  override name = "InternalServerError";
}

/** The request never got an HTTP response: DNS, TLS, connection reset, and similar. */
export class APIConnectionError extends EdgazeError {
  override name = "APIConnectionError";
  constructor(message = "Connection error.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** The request took longer than the `timeout` option. */
export class APIConnectionTimeoutError extends APIConnectionError {
  override name = "APIConnectionTimeoutError";
  constructor(message = "Request timed out.") {
    super(message);
  }
}

/** You aborted the request through the `signal` option. */
export class APIUserAbortError extends EdgazeError {
  override name = "APIUserAbortError";
  constructor(message = "Request was aborted.") {
    super(message);
  }
}

/** A webhook delivery failed signature verification. Respond 400 and do not process it. */
export class WebhookVerificationError extends EdgazeError {
  override name = "WebhookVerificationError";
}

/** `runs.wait` gave up before the run reached a terminal status. The run itself keeps going. */
export class RunWaitTimeoutError extends EdgazeError {
  override name = "RunWaitTimeoutError";
  readonly runId: string;
  constructor(runId: string, timeoutMs: number) {
    super(`Run ${runId} did not finish within ${timeoutMs} ms. It is still running on Edgaze.`);
    this.runId = runId;
  }
}

/** Parses `Retry-After` (seconds or an HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  // Anything else must be an HTTP date ("Sat, 07 Nov 2026 10:00:30 GMT"). Date.parse alone would
  // also accept strings like "-1" as a year.
  if (!/[a-z]/i.test(trimmed)) return null;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

function parseErrorBody(body: unknown): {
  code: string;
  message: string;
  details?: ErrorDetail[] | IntegrationConnectionDetail[];
} | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  const { code, message, details } = body.error;
  if (typeof code !== "string" || code === "") return null;
  return {
    code,
    message: typeof message === "string" && message !== "" ? message : fallbackMessage(0, null),
    ...(Array.isArray(details)
      ? { details: details as ErrorDetail[] | IntegrationConnectionDetail[] }
      : {}),
  };
}

function fallbackCode(status: number): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "internal_error";
  return "http_error";
}

function fallbackMessage(status: number, body: unknown): string {
  if (typeof body === "string" && body.trim() !== "") return body.trim().slice(0, 500);
  return status ? `Request failed with status ${status}.` : "Request failed.";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
