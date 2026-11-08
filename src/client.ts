import { EdgazeError } from "./core/errors.js";
import { Transport, type Fetch } from "./core/transport.js";
import { readEnv } from "./core/utils.js";
import { Runs } from "./resources/runs.js";
import { Workflows } from "./resources/workflows.js";
import { unwrapWebhook, type WebhookDelivery, type WebhookHeaders } from "./webhooks.js";

export const DEFAULT_BASE_URL = "https://api.edgaze.ai/v1";
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RETRY_AFTER_MS = 60_000;

export interface ClientOptions {
  /** Your API key. Defaults to the `EDGAZE_API_KEY` environment variable. */
  apiKey?: string | undefined;
  /** API base URL including `/v1`. Defaults to `EDGAZE_BASE_URL`, then the production API. */
  baseURL?: string | undefined;
  /** Per-attempt timeout in milliseconds. Defaults to 60 000. */
  timeout?: number | undefined;
  /**
   * Retries for connection errors, timeouts, 408, 425, 429 and 5xx responses, with exponential
   * backoff that honours `Retry-After`. Defaults to 2. Starting a run is retried safely because
   * every request carries an Idempotency-Key.
   */
  maxRetries?: number | undefined;
  /** Headers sent with every request. */
  defaultHeaders?: Record<string, string | null | undefined> | undefined;
  /** A custom `fetch` (for proxies, instrumentation or tests). Defaults to `globalThis.fetch`. */
  fetch?: Fetch | undefined;
  /** Signing secret for `client.webhooks.unwrap`. Defaults to `EDGAZE_WEBHOOK_SECRET`. */
  webhookSecret?: string | undefined;
  /**
   * The SDK refuses to run in a browser because that would expose your API key to every visitor.
   * Set this only if the key is safe to expose (for example a local tool).
   */
  dangerouslyAllowBrowser?: boolean | undefined;
}

/**
 * The Edgaze API client.
 *
 * ```ts
 * import Edgaze from "@edgaze/sdk";
 *
 * const client = new Edgaze(); // reads EDGAZE_API_KEY
 * const run = await client.runs.createAndWait({ workflow: "…", inputs: { topic: "tides" } });
 * ```
 */
export class Edgaze {
  readonly workflows: Workflows;
  readonly runs: Runs;
  readonly webhooks: ClientWebhooks;
  readonly baseURL: string;

  private readonly transport: Transport;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? readEnv("EDGAZE_API_KEY");
    if (!apiKey) {
      throw new EdgazeError(
        "Missing API key. Pass `apiKey` to `new Edgaze()` or set the EDGAZE_API_KEY environment variable. Create a key at https://www.edgaze.ai/developer/keys.",
      );
    }
    const isBrowser =
      typeof (globalThis as { window?: unknown }).window !== "undefined" &&
      typeof (globalThis as { document?: unknown }).document !== "undefined";
    if (isBrowser && !options.dangerouslyAllowBrowser) {
      throw new EdgazeError(
        "The Edgaze SDK is meant for servers. Running it in a browser would expose your API key to anyone who opens the page. Call Edgaze from your backend, or pass `dangerouslyAllowBrowser: true` if the key is safe to expose.",
      );
    }
    const fetchImpl = options.fetch ?? (globalThis.fetch?.bind(globalThis) as Fetch | undefined);
    if (!fetchImpl) {
      throw new EdgazeError(
        "No fetch implementation found. Use Node 18 or later, or pass `fetch` to `new Edgaze()`.",
      );
    }
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new EdgazeError("timeout must be a positive number of milliseconds.");
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new EdgazeError("maxRetries must be a non-negative integer.");
    }
    this.baseURL = (options.baseURL ?? readEnv("EDGAZE_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    try {
      new URL(this.baseURL);
    } catch {
      throw new EdgazeError(`baseURL is not a valid URL: ${this.baseURL}`);
    }
    this.transport = new Transport({
      apiKey,
      baseURL: this.baseURL,
      timeout,
      maxRetries,
      fetch: fetchImpl,
      defaultHeaders: options.defaultHeaders ?? {},
      maxRetryAfterMs: DEFAULT_MAX_RETRY_AFTER_MS,
      isBrowser,
    });
    this.workflows = new Workflows(this.transport);
    this.runs = new Runs(this.transport);
    this.webhooks = new ClientWebhooks(options.webhookSecret ?? readEnv("EDGAZE_WEBHOOK_SECRET"));
  }
}

/** Webhook verification bound to the client's `webhookSecret`. */
export class ClientWebhooks {
  constructor(private readonly secret: string | undefined) {}

  /**
   * Verifies a delivery and returns its parsed event. Pass the raw body, not parsed JSON.
   * Throws WebhookVerificationError when the signature is missing, wrong or stale.
   */
  unwrap(
    payload: string | Uint8Array | ArrayBuffer,
    headers: WebhookHeaders,
    options: { secret?: string; toleranceSeconds?: number } = {},
  ): Promise<WebhookDelivery> {
    const secret = options.secret ?? this.secret;
    if (!secret) {
      return Promise.reject(
        new EdgazeError(
          "Missing webhook secret. Pass `webhookSecret` to `new Edgaze()`, set EDGAZE_WEBHOOK_SECRET, or pass `secret` here.",
        ),
      );
    }
    return unwrapWebhook({ payload, headers, secret, toleranceSeconds: options.toleranceSeconds });
  }
}
