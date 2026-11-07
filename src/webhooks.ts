import { WebhookVerificationError, isRecord } from "./core/errors.js";
import type { WebhookEvent } from "./types.js";

export const WEBHOOK_SIGNATURE_HEADER = "edgaze-signature";
export const WEBHOOK_ID_HEADER = "edgaze-webhook-id";
export const WEBHOOK_DELIVERY_ID_HEADER = "edgaze-delivery-id";
export const WEBHOOK_ATTEMPT_HEADER = "edgaze-attempt";
export const WEBHOOK_EVENT_HEADER = "edgaze-event";

/** Default freshness window. Deliveries signed longer ago than this are rejected as replays. */
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

/** Headers as any common server framework exposes them. */
export type WebhookHeaders =
  Headers | Record<string, string | string[] | undefined> | Iterable<[string, string]>;

export interface WebhookDelivery {
  /** The verified, parsed body. Branch on `event.type`. */
  event: WebhookEvent;
  /**
   * Stable across retries of the same event: your deduplication key. Null on test deliveries and
   * rare single-attempt fallback deliveries; deduplicate those on `runId` plus `type`.
   */
  deliveryId: string | null;
  /** The endpoint this delivery was sent to. Use it to pick the secret when you have several. */
  webhookId: string | null;
  /** 1-based attempt number. Greater than 1 means an earlier attempt failed. */
  attempt: number | null;
}

export interface UnwrapWebhookParams {
  /** The raw request body, exactly as received. Re-serialized JSON will not verify. */
  payload: string | Uint8Array | ArrayBuffer;
  headers: WebhookHeaders;
  /** The endpoint's signing secret from the developer console. */
  secret: string;
  /** Accepted clock difference, in seconds. Defaults to 300. */
  toleranceSeconds?: number | undefined;
  /** Current time in Unix seconds. For tests. */
  now?: number | undefined;
}

/**
 * Verifies a webhook delivery's signature and returns the parsed event. Throws
 * WebhookVerificationError when the signature is missing, wrong or stale. Works in Node, Deno,
 * Bun, browsers and edge runtimes (it uses Web Crypto).
 *
 * ```ts
 * const { event, deliveryId } = await unwrapWebhook({
 *   payload: await request.text(),
 *   headers: request.headers,
 *   secret: process.env.EDGAZE_WEBHOOK_SECRET!,
 * });
 * ```
 */
export async function unwrapWebhook(params: UnwrapWebhookParams): Promise<WebhookDelivery> {
  await verifyWebhookSignature(params);
  const payload = toText(params.payload);
  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new WebhookVerificationError("The webhook body is not valid JSON.");
  }
  if (!isRecord(event) || typeof event.type !== "string") {
    throw new WebhookVerificationError("The webhook body has no event type.");
  }
  const attempt = Number(header(params.headers, WEBHOOK_ATTEMPT_HEADER));
  return {
    event: event as unknown as WebhookEvent,
    deliveryId: header(params.headers, WEBHOOK_DELIVERY_ID_HEADER),
    webhookId: header(params.headers, WEBHOOK_ID_HEADER),
    attempt: Number.isSafeInteger(attempt) && attempt > 0 ? attempt : null,
  };
}

/**
 * Checks the `edgaze-signature` header against the raw body. Resolves when valid; throws
 * WebhookVerificationError otherwise.
 */
export async function verifyWebhookSignature(params: UnwrapWebhookParams): Promise<void> {
  if (typeof params.secret !== "string" || params.secret === "") {
    throw new WebhookVerificationError("A webhook signing secret is required.");
  }
  const signature = header(params.headers, WEBHOOK_SIGNATURE_HEADER);
  if (!signature) {
    throw new WebhookVerificationError(`Missing the ${WEBHOOK_SIGNATURE_HEADER} header.`);
  }
  const { timestamp, signatures } = parseSignatureHeader(signature);
  const tolerance = params.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  const now = params.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError(
      `The webhook timestamp is outside the ${tolerance} second tolerance.`,
    );
  }
  // Signed over the exact bytes received: `{t}.{raw body}`.
  const expected = await hmacSha256(
    params.secret,
    concat(new TextEncoder().encode(`${timestamp}.`), toBytes(params.payload)),
  );
  for (const candidate of signatures) {
    if (constantTimeEqual(expected, candidate)) return;
  }
  throw new WebhookVerificationError("The webhook signature does not match.");
}

/** Creates a signature header for a payload. For testing your webhook handler. */
export async function signWebhookPayload(params: {
  payload: string;
  secret: string;
  timestamp?: number;
}): Promise<string> {
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
  const hex = await hmacSha256(
    params.secret,
    new TextEncoder().encode(`${timestamp}.${params.payload}`),
  );
  return `t=${timestamp},v1=${hex}`;
}

function parseSignatureHeader(value: string): { timestamp: number; signatures: string[] } {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of value.split(",")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (key === "t" && /^\d+$/.test(v)) timestamp = Number(v);
    else if (key === "v1" && /^[0-9a-fA-F]+$/.test(v)) signatures.push(v.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) {
    throw new WebhookVerificationError(`The ${WEBHOOK_SIGNATURE_HEADER} header is malformed.`);
  }
  return { timestamp, signatures };
}

async function hmacSha256(secret: string, message: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new WebhookVerificationError("Web Crypto (globalThis.crypto.subtle) is not available.");
  }
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await subtle.sign("HMAC", key, message as Uint8Array<ArrayBuffer>));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBytes(payload: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof payload === "string") return new TextEncoder().encode(payload);
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  throw new WebhookVerificationError(
    "The webhook payload must be the raw body as a string or bytes.",
  );
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function toText(payload: string | Uint8Array | ArrayBuffer): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof ArrayBuffer || payload instanceof Uint8Array) {
    return new TextDecoder("utf-8", { fatal: false }).decode(payload);
  }
  throw new WebhookVerificationError(
    "The webhook payload must be the raw body as a string or bytes.",
  );
}

function header(headers: WebhookHeaders, name: string): string | null {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  if (Symbol.iterator in headers && !isPlainRecord(headers)) {
    for (const [key, value] of headers as Iterable<[string, string]>) {
      if (key.toLowerCase() === name) return value;
    }
    return null;
  }
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() !== name) continue;
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function isPlainRecord(value: unknown): boolean {
  return Object.prototype.toString.call(value) === "[object Object]";
}
